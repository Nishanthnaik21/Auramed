"""Unit and Regression Tests for AuraMed Async Pharmacology Service."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from pharmacology_service import (
    AsyncPharmacologyService,
    MetabolicFrictionReport,
    EnzymeCompetition,
    InhibitionConflict,
)


@pytest.mark.asyncio
async def test_empty_medication_list():
    service = AsyncPharmacologyService(uri="neo4j://localhost:7687")
    # Should short-circuit without querying driver
    report = await service.detect_metabolic_friction([])
    assert report.confounder_risk_score == 0.0
    assert not report.clinical_adherence_confounder_detected
    assert len(report.clearance_competitions) == 0
    await service.close()


@pytest.mark.asyncio
async def test_metabolic_friction_with_mocked_graph():
    service = AsyncPharmacologyService(uri="neo4j://localhost:7687")

    # Mock session and query results
    mock_session = AsyncMock()

    # Mock competition records (e.g. Atorvastatin and Amlodipine on CYP3A4)
    comp_result = AsyncMock()
    comp_result.data = AsyncMock(return_value=[
        {
            "enzyme": "CYP3A4",
            "drug_a": "Amlodipine",
            "rxnorm_a": "17767",
            "clearance_fraction_a": 0.60,
            "drug_b": "Atorvastatin",
            "rxnorm_b": "83367",
            "clearance_fraction_b": 0.85,
        }
    ])

    # Mock inhibition records (e.g. Amlodipine weak inhibition on CYP3A4)
    inh_result = AsyncMock()
    inh_result.data = AsyncMock(return_value=[
        {
            "inhibitor_name": "Amlodipine",
            "inhibitor_rxnorm": "17767",
            "potency": "WEAK",
            "pathway": "CYP3A4",
            "substrate_name": "Atorvastatin",
            "substrate_rxnorm": "83367",
            "bioactivation_required": False,
            "clinical_effect": "Can increase statin exposure",
        }
    ])

    # Return different mock results based on call order or query text
    async def run_mock(query, **kwargs):
        if "id(m1) < id(m2)" in query:
            return comp_result
        elif "INHIBITS" in query:
            return inh_result
        mock_generic = AsyncMock()
        mock_generic.data = AsyncMock(return_value=[])
        return mock_generic

    mock_session.run.side_effect = run_mock

    # Mock driver session context manager
    service.driver.session = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_session), __aexit__=AsyncMock()))

    report = await service.detect_metabolic_friction(["Atorvastatin", "Amlodipine"])

    assert len(report.clearance_competitions) == 1
    comp = report.clearance_competitions[0]
    assert comp.enzyme == "CYP3A4"
    assert comp.competition_severity == "HIGH"

    assert len(report.inhibition_conflicts) == 1
    inh = report.inhibition_conflicts[0]
    assert inh.inhibitor_name == "Amlodipine"
    assert inh.substrate_name == "Atorvastatin"

    # Risk score calculation: 0.20 (CYP3A4 competition) + 0.10 (weak inhibition) = 0.30
    assert report.confounder_risk_score == pytest.approx(0.30, abs=1e-3)
    assert report.clinical_adherence_confounder_detected is True
    assert "CYP3A4" in report.clinical_summary

    await service.close()


@pytest.mark.asyncio
async def test_strong_inhibition_confrontation():
    service = AsyncPharmacologyService(uri="neo4j://localhost:7687")

    mock_session = AsyncMock()
    comp_result = AsyncMock()
    comp_result.data = AsyncMock(return_value=[])

    # Omeprazole strongly inhibiting CYP2C19 (Clopidogrel substrate requiring bioactivation)
    inh_result = AsyncMock()
    inh_result.data = AsyncMock(return_value=[
        {
            "inhibitor_name": "Omeprazole",
            "inhibitor_rxnorm": "7646",
            "potency": "STRONG",
            "pathway": "CYP2C19",
            "substrate_name": "Clopidogrel",
            "substrate_rxnorm": "32968",
            "bioactivation_required": True,
            "clinical_effect": "Blocks bioactivation of clopidogrel",
        }
    ])

    async def run_mock(query, **kwargs):
        if "id(m1) < id(m2)" in query:
            return comp_result
        return inh_result

    mock_session.run.side_effect = run_mock
    service.driver.session = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_session), __aexit__=AsyncMock()))

    report = await service.detect_metabolic_friction(["Omeprazole", "Clopidogrel"])

    assert len(report.inhibition_conflicts) == 1
    assert report.inhibition_conflicts[0].bioactivation_required is True
    # Strong inhibition = 0.40 score
    assert report.confounder_risk_score >= 0.40
    assert report.clinical_adherence_confounder_detected is True

    await service.close()
