"""AuraMed Async Pharmacology & Confounder Analysis Service.

Utilizes neo4j-python-driver to traverse the pharmacology knowledge graph,
detecting metabolic clearance competition (CYP450 pathways), enzymatic inhibition,
and drug-drug friction confounding lab response signals (SBP, HbA1c).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple
from neo4j import AsyncGraphDatabase, AsyncDriver
from pydantic import BaseModel, Field

logger = logging.getLogger("auramed.pharmacology")


# ---------------------------------------------------------------------------
# Pydantic Response Data Models
# ---------------------------------------------------------------------------

class EnzymeCompetition(BaseModel):
    enzyme: str
    drug_a: str
    rxnorm_a: str
    clearance_fraction_a: Optional[float] = None
    drug_b: str
    rxnorm_b: str
    clearance_fraction_b: Optional[float] = None
    competition_severity: str = "MODERATE"


class InhibitionConflict(BaseModel):
    inhibitor_name: str
    inhibitor_rxnorm: str
    inhibition_potency: str
    pathway: str
    substrate_name: str
    substrate_rxnorm: str
    bioactivation_required: bool = False
    clinical_effect: Optional[str] = None


class LabModulationSignal(BaseModel):
    medication: str
    rxnorm: str
    biomarker: str
    loinc: str
    expected_delta: float
    inhibiting_confounds: List[Dict[str, Any]] = Field(default_factory=list)


class MetabolicFrictionReport(BaseModel):
    active_medications_evaluated: List[str]
    clearance_competitions: List[EnzymeCompetition] = Field(default_factory=list)
    inhibition_conflicts: List[InhibitionConflict] = Field(default_factory=list)
    confounded_lab_signals: List[LabModulationSignal] = Field(default_factory=list)
    confounder_risk_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Normalized risk metric (0.0 - 1.0) quantifying pharmacokinetic friction confounding lab response"
    )
    clinical_adherence_confounder_detected: bool = False
    clinical_summary: str = ""


# ---------------------------------------------------------------------------
# Async Pharmacology Service
# ---------------------------------------------------------------------------

class AsyncPharmacologyService:
    """High-throughput async client for Neo4j Pharmacology Knowledge Graph."""

    def __init__(
        self,
        uri: str = "neo4j://localhost:7687",
        auth: Tuple[str, str] = ("neo4j", "auramedpassword"),
        database: str = "neo4j",
        max_connection_pool_size: int = 50,
    ):
        self.uri = uri
        self.auth = auth
        self.database = database
        self.driver: AsyncDriver = AsyncGraphDatabase.driver(
            self.uri,
            auth=self.auth,
            max_connection_pool_size=max_connection_pool_size,
            connection_timeout=5.0,
        )

    async def close(self) -> None:
        """Close driver connection pool."""
        await self.driver.close()

    async def __aenter__(self) -> AsyncPharmacologyService:
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()

    async def detect_metabolic_friction(
        self,
        active_medications: Sequence[str],
        target_biomarker_loinc: Optional[str] = None,
    ) -> MetabolicFrictionReport:
        """Traverse the knowledge graph to detect metabolic clearance competition

        and enzymatic inhibition among active medications, evaluating their impact
        on target biomarker response signals.

        :param active_medications: List of medication names or RxNorm IDs.
        :param target_biomarker_loinc: Optional LOINC code (e.g. '8480-6' for SBP, '4548-4' for HbA1c).
        :return: MetabolicFrictionReport
        """
        if not active_medications:
            return MetabolicFrictionReport(
                active_medications_evaluated=[],
                clinical_summary="No active medications provided for evaluation.",
            )

        med_list = [str(m).strip() for m in active_medications if str(m).strip()]
        med_names_lower = [m.lower() for m in med_list]

        async with self.driver.session(database=self.database) as session:
            # 1. Query Clearance Pathway Competition (Shared METABOLIZED_BY)
            competition_query = """
            MATCH (m1:Medication)-[r1:METABOLIZED_BY]->(c:ClearancePathway)<-[r2:METABOLIZED_BY]-(m2:Medication)
            WHERE (m1.rxnorm_id IN $med_list OR toLower(m1.name) IN $med_names_lower)
              AND (m2.rxnorm_id IN $med_list OR toLower(m2.name) IN $med_names_lower)
              AND id(m1) < id(m2)
            RETURN c.enzyme_name AS enzyme,
                   m1.name AS drug_a, m1.rxnorm_id AS rxnorm_a, r1.clearance_fraction AS clearance_fraction_a,
                   m2.name AS drug_b, m2.rxnorm_id AS rxnorm_b, r2.clearance_fraction AS clearance_fraction_b
            """
            comp_result = await session.run(
                competition_query,
                med_list=med_list,
                med_names_lower=med_names_lower,
            )
            comp_records = await comp_result.data()

            competitions: List[EnzymeCompetition] = []
            for r in comp_records:
                # Hepatic CYP3A4 and CYP2C9 carry high competitive risk due to saturable kinetics
                enzyme = r["enzyme"]
                severity = "HIGH" if enzyme in ("CYP3A4", "CYP2C9") else "MODERATE"
                competitions.append(
                    EnzymeCompetition(
                        enzyme=enzyme,
                        drug_a=r["drug_a"],
                        rxnorm_a=r["rxnorm_a"],
                        clearance_fraction_a=r.get("clearance_fraction_a"),
                        drug_b=r["drug_b"],
                        rxnorm_b=r["rxnorm_b"],
                        clearance_fraction_b=r.get("clearance_fraction_b"),
                        competition_severity=severity,
                    )
                )

            # 2. Query Direct Enzymatic Inhibition (Drug-Drug Friction)
            inhibition_query = """
            MATCH (inhibitor:Medication)-[inh:INHIBITS]->(c:ClearancePathway)<-[met:METABOLIZED_BY]-(substrate:Medication)
            WHERE (inhibitor.rxnorm_id IN $med_list OR toLower(inhibitor.name) IN $med_names_lower)
              AND (substrate.rxnorm_id IN $med_list OR toLower(substrate.name) IN $med_names_lower)
              AND inhibitor <> substrate
            RETURN inhibitor.name AS inhibitor_name, inhibitor.rxnorm_id AS inhibitor_rxnorm,
                   inh.inhibition_potency AS potency, inh.clinical_effect AS clinical_effect,
                   c.enzyme_name AS pathway,
                   substrate.name AS substrate_name, substrate.rxnorm_id AS substrate_rxnorm,
                   coalesce(met.bioactivation_required, false) AS bioactivation_required
            """
            inh_result = await session.run(
                inhibition_query,
                med_list=med_list,
                med_names_lower=med_names_lower,
            )
            inh_records = await inh_result.data()

            inhibitions: List[InhibitionConflict] = []
            for r in inh_records:
                inhibitions.append(
                    InhibitionConflict(
                        inhibitor_name=r["inhibitor_name"],
                        inhibitor_rxnorm=r["inhibitor_rxnorm"],
                        inhibition_potency=r.get("potency", "MODERATE"),
                        pathway=r["pathway"],
                        substrate_name=r["substrate_name"],
                        substrate_rxnorm=r["substrate_rxnorm"],
                        bioactivation_required=r["bioactivation_required"],
                        clinical_effect=r.get("clinical_effect"),
                    )
                )

            # 3. Query Confounded Lab Response Signals
            lab_confounds: List[LabModulationSignal] = []
            if target_biomarker_loinc:
                lab_query = """
                MATCH (m:Medication)-[mod:MODULATES]->(b:TargetBiomarker {loinc_code: $loinc})
                WHERE (m.rxnorm_id IN $med_list OR toLower(m.name) IN $med_names_lower)
                OPTIONAL MATCH (other:Medication)-[inh:INHIBITS]->(c:ClearancePathway)<-[:METABOLIZED_BY]-(m)
                WHERE (other.rxnorm_id IN $med_list OR toLower(other.name) IN $med_names_lower)
                  AND other <> m
                RETURN m.name AS medication, m.rxnorm_id AS rxnorm,
                       b.name AS biomarker, b.loinc_code AS loinc,
                       mod.expected_delta_per_standard_dose AS expected_delta,
                       collect(CASE WHEN other IS NOT NULL THEN {
                           inhibitor: other.name,
                           pathway: c.enzyme_name,
                           potency: inh.inhibition_potency,
                           clinical_effect: inh.clinical_effect
                       } ELSE null END) AS confounds
                """
                lab_result = await session.run(
                    lab_query,
                    med_list=med_list,
                    med_names_lower=med_names_lower,
                    loinc=target_biomarker_loinc,
                )
                lab_records = await lab_result.data()
                for r in lab_records:
                    filtered_confounds = [c for c in r.get("confounds", []) if c is not None]
                    lab_confounds.append(
                        LabModulationSignal(
                            medication=r["medication"],
                            rxnorm=r["rxnorm"],
                            biomarker=r["biomarker"],
                            loinc=r["loinc"],
                            expected_delta=r["expected_delta"],
                            inhibiting_confounds=filtered_confounds,
                        )
                    )

            # 4. Calculate Confounder Risk Score (0.0 to 1.0)
            score = 0.0
            # Weight inhibitions heavily
            for inh in inhibitions:
                if inh.inhibition_potency == "STRONG":
                    score += 0.40
                elif inh.inhibition_potency == "MODERATE":
                    score += 0.25
                else:
                    score += 0.10

            # Weight enzymatic competitions
            for comp in competitions:
                if comp.competition_severity == "HIGH":
                    score += 0.20
                else:
                    score += 0.10

            normalized_score = min(1.0, score)
            confounder_detected = normalized_score >= 0.30

            # Build clinical explanation
            summary_parts = []
            if inhibitions:
                summary_parts.append(
                    f"{len(inhibitions)} enzymatic inhibition conflict(s) detected: "
                    + "; ".join(
                        f"{i.inhibitor_name} inhibits {i.pathway} ({i.substrate_name})"
                        for i in inhibitions
                    )
                )
            if competitions:
                summary_parts.append(
                    f"{len(competitions)} clearance pathway competition(s) identified on "
                    + ", ".join({c.enzyme for c in competitions})
                )
            if not summary_parts:
                summary = "No significant metabolic clearance competition or enzymatic friction detected across active regimen."
            else:
                summary = ". ".join(summary_parts) + "."

            return MetabolicFrictionReport(
                active_medications_evaluated=med_list,
                clearance_competitions=competitions,
                inhibition_conflicts=inhibitions,
                confounded_lab_signals=lab_confounds,
                confounder_risk_score=round(normalized_score, 3),
                clinical_adherence_confounder_detected=confounder_detected,
                clinical_summary=summary,
            )
