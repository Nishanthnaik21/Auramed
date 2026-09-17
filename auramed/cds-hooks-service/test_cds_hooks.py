"""Unit and Integration Tests for AuraMed CDS Hooks Service."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from main import app, tokenize_patient_id

client = TestClient(app)


def test_cds_services_discovery():
    response = client.get("/cds-services")
    assert response.status_code == 200
    data = response.json()
    assert "services" in data
    assert len(data["services"]) == 2

    hooks = [s["hook"] for s in data["services"]]
    assert "patient-view" in hooks
    assert "medication-prescribe" in hooks


@pytest.mark.asyncio
async def test_alert_suppressed_when_patient_is_concordant():
    """Asserts that NO card is returned when the patient is concordant (PDC >= 0.80)."""
    mock_features = {
        "pdc_90d": "0.92",
        "refill_gap_index": "0.05",
        "pickup_interval_variance": "1.2",
        "covered_days": "85",
        "sbp_slope_per_day": "-0.10",
    }

    with patch("main.fetch_patient_features", new=AsyncMock(return_value=mock_features)):
        payload = {
            "hook": "patient-view",
            "hookInstance": "550e8400-e29b-41d4-a716-446655440000",
            "context": {"patientId": "MRN-CONCORDANT-101", "userId": "DrSmith"},
        }
        response = client.post("/cds-services/auramed-patient-view", json=payload)
        assert response.status_code == 200
        result = response.json()
        # MUST BE EMPTY to prevent clinician alert fatigue
        assert result["cards"] == [], "Concordant patient must not trigger intrusive alerts"


@pytest.mark.asyncio
async def test_alert_suppressed_when_uncertainty_is_high():
    """Asserts that NO card is returned when epistemic uncertainty is elevated (entropy > 0.10)."""
    # Borderline ambiguous telemetry
    mock_features = {
        "pdc_90d": "0.78",
        "refill_gap_index": "0.22",
        "pickup_interval_variance": "3.5",  # Ambiguous zone
        "covered_days": "70",
    }

    with patch("main.fetch_patient_features", new=AsyncMock(return_value=mock_features)):
        payload = {
            "hook": "patient-view",
            "hookInstance": "550e8400-e29b-41d4-a716-446655440001",
            "context": {"patientId": "MRN-AMBIGUOUS-202", "userId": "DrSmith"},
        }
        response = client.post("/cds-services/auramed-patient-view", json=payload)
        assert response.status_code == 200
        result = response.json()
        assert result["cards"] == [], "High uncertainty / indeterminate state must suppress cards"


@pytest.mark.asyncio
async def test_card_generated_when_therapeutic_discordance_confirmed():
    """Asserts that a non-punitive card with ServiceRequest orders is returned when discordance is confirmed."""
    mock_features = {
        "pdc_90d": "0.52",
        "refill_gap_index": "0.48",
        "pickup_interval_variance": "14.2",
        "covered_days": "47",
        "sbp_slope_per_day": "0.22",
    }

    with patch("main.fetch_patient_features", new=AsyncMock(return_value=mock_features)):
        payload = {
            "hook": "patient-view",
            "hookInstance": "550e8400-e29b-41d4-a716-446655440002",
            "context": {"patientId": "MRN-DISCORDANT-303", "userId": "DrSmith"},
        }
        response = client.post("/cds-services/auramed-patient-view", json=payload)
        assert response.status_code == 200
        result = response.json()

        assert len(result["cards"]) == 1
        card = result["cards"][0]

        # Non-punitive objective title
        assert card["summary"] == "Therapeutic Discordance Observed"
        assert card["indicator"] == "warning"
        assert "52%" in card["detail"]

        # Actionable clinical suggestions
        assert len(card["suggestions"]) >= 2
        labels = [s["label"] for s in card["suggestions"]]
        assert "Order Comprehensive Metabolic Panel (CMP)" in labels

        # Validate FHIR ServiceRequest order structure
        cmp_suggestion = next(s for s in card["suggestions"] if "CMP" in s["label"])
        action = cmp_suggestion["actions"][0]
        assert action["type"] == "create"
        resource = action["resource"]
        assert resource["resourceType"] == "ServiceRequest"
        assert resource["code"]["coding"][0]["code"] == "24323-8"
        assert resource["subject"]["reference"] == "Patient/MRN-DISCORDANT-303"

        # Validate SMART-on-FHIR launch link
        assert len(card["links"]) == 1
        link = card["links"][0]
        assert link["type"] == "smart"
        assert "launch" in link["url"]
