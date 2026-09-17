// ==============================================================================
// AuraMed Pharmacology Knowledge Graph - Seed Migration Script
// Author: Lead Data Architect & Healthcare Systems Engineer
// System: Neo4j 5.x Graph Database
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. Schema Constraints & High-Performance Indexes
// ------------------------------------------------------------------------------

CREATE CONSTRAINT unique_medication_rxnorm IF NOT EXISTS
FOR (m:Medication) REQUIRE m.rxnorm_id IS UNIQUE;

CREATE CONSTRAINT unique_biomarker_loinc IF NOT EXISTS
FOR (b:TargetBiomarker) REQUIRE b.loinc_code IS UNIQUE;

CREATE CONSTRAINT unique_clearance_pathway IF NOT EXISTS
FOR (c:ClearancePathway) REQUIRE c.enzyme_name IS UNIQUE;

CREATE CONSTRAINT unique_condition_icd10 IF NOT EXISTS
FOR (c:Condition) REQUIRE c.icd10_code IS UNIQUE;

CREATE INDEX idx_medication_name IF NOT EXISTS
FOR (m:Medication) ON (m.name);

// ------------------------------------------------------------------------------
// 2. Clearance Pathways (Cytochrome P450 Enzymes)
// ------------------------------------------------------------------------------

MERGE (cyp3a4:ClearancePathway {enzyme_name: "CYP3A4"})
ON CREATE SET
  cyp3a4.name = "Cytochrome P450 Family 3 Subfamily A Member 4",
  cyp3a4.system = "Hepatic Microsomal",
  cyp3a4.organ = "Liver & Small Intestine",
  cyp3a4.metabolizes_fraction = 0.45;

MERGE (cyp2c9:ClearancePathway {enzyme_name: "CYP2C9"})
ON CREATE SET
  cyp2c9.name = "Cytochrome P450 Family 2 Subfamily C Member 9",
  cyp2c9.system = "Hepatic Microsomal",
  cyp2c9.organ = "Liver",
  cyp2c9.metabolizes_fraction = 0.15;

MERGE (cyp2d6:ClearancePathway {enzyme_name: "CYP2D6"})
ON CREATE SET
  cyp2d6.name = "Cytochrome P450 Family 2 Subfamily D Member 6",
  cyp2d6.system = "Hepatic Microsomal",
  cyp2d6.organ = "Liver & CNS",
  cyp2d6.metabolizes_fraction = 0.20;

MERGE (cyp2c19:ClearancePathway {enzyme_name: "CYP2C19"})
ON CREATE SET
  cyp2c19.name = "Cytochrome P450 Family 2 Subfamily C Member 19",
  cyp2c19.system = "Hepatic Microsomal",
  cyp2c19.organ = "Liver",
  cyp2c19.metabolizes_fraction = 0.08;

MERGE (renal:ClearancePathway {enzyme_name: "RENAL_FILTRATION"})
ON CREATE SET
  renal.name = "Glomerular Filtration & Tubular Secretion",
  renal.system = "Renal Excretion",
  renal.organ = "Kidney",
  renal.metabolizes_fraction = 0.12;

// ------------------------------------------------------------------------------
// 3. Target Clinical Biomarkers
// ------------------------------------------------------------------------------

MERGE (sbp:TargetBiomarker {loinc_code: "8480-6"})
ON CREATE SET
  sbp.name = "Systolic Blood Pressure",
  sbp.unit = "mm[Hg]",
  sbp.expected_delta_percent_per_std_dose = -7.5,
  sbp.physiological_target = "< 130 mm[Hg]";

MERGE (dbp:TargetBiomarker {loinc_code: "8462-4"})
ON CREATE SET
  dbp.name = "Diastolic Blood Pressure",
  dbp.unit = "mm[Hg]",
  dbp.expected_delta_percent_per_std_dose = -5.0,
  dbp.physiological_target = "< 80 mm[Hg]";

MERGE (hba1c:TargetBiomarker {loinc_code: "4548-4"})
ON CREATE SET
  hba1c.name = "Hemoglobin A1c",
  hba1c.unit = "%",
  hba1c.expected_delta_percent_per_std_dose = -1.2,
  hba1c.physiological_target = "< 7.0 %";

MERGE (ldlc:TargetBiomarker {loinc_code: "13457-7"})
ON CREATE SET
  ldlc.name = "Low-Density Lipoprotein Cholesterol (LDL-C)",
  ldlc.unit = "mg/dL",
  ldlc.expected_delta_percent_per_std_dose = -35.0,
  ldlc.physiological_target = "< 70 mg/dL";

// ------------------------------------------------------------------------------
// 4. Clinical Conditions (ICD-10)
// ------------------------------------------------------------------------------

MERGE (htn:Condition {icd10_code: "I10"})
ON CREATE SET
  htn.name = "Essential (Primary) Hypertension",
  htn.disease_class = "Cardiovascular";

MERGE (t2d:Condition {icd10_code: "E11.9"})
ON CREATE SET
  t2d.name = "Type 2 Diabetes Mellitus without complications",
  t2d.disease_class = "Endocrine, Nutritional and Metabolic";

MERGE (hyperlip:Condition {icd10_code: "E78.5"})
ON CREATE SET
  hyperlip.name = "Hyperlipidemia, Unspecified",
  hyperlip.disease_class = "Metabolic";

MERGE (cad:Condition {icd10_code: "I25.10"})
ON CREATE SET
  cad.name = "Atherosclerotic Heart Disease",
  cad.disease_class = "Cardiovascular";

// ------------------------------------------------------------------------------
// 5. Medications
// ------------------------------------------------------------------------------

MERGE (lisinopril:Medication {rxnorm_id: "29046"})
ON CREATE SET
  lisinopril.name = "Lisinopril",
  lisinopril.half_life_hours = 12.0,
  lisinopril.standard_dose_mg = 20.0,
  lisinopril.therapeutic_class = "ACE Inhibitor";

MERGE (losartan:Medication {rxnorm_id: "5224"})
ON CREATE SET
  losartan.name = "Losartan",
  losartan.half_life_hours = 2.0, // Active metabolite E-3174 has t1/2 of 6-9 hrs
  losartan.standard_dose_mg = 50.0,
  losartan.therapeutic_class = "Angiotensin Receptor Blocker (ARB)";

MERGE (amlodipine:Medication {rxnorm_id: "17767"})
ON CREATE SET
  amlodipine.name = "Amlodipine",
  amlodipine.half_life_hours = 40.0,
  amlodipine.standard_dose_mg = 5.0,
  amlodipine.therapeutic_class = "Dihydropyridine Calcium Channel Blocker";

MERGE (atorvastatin:Medication {rxnorm_id: "83367"})
ON CREATE SET
  atorvastatin.name = "Atorvastatin",
  atorvastatin.half_life_hours = 14.0,
  atorvastatin.standard_dose_mg = 20.0,
  atorvastatin.therapeutic_class = "HMG-CoA Reductase Inhibitor (Statin)";

MERGE (simvastatin:Medication {rxnorm_id: "36567"})
ON CREATE SET
  simvastatin.name = "Simvastatin",
  simvastatin.half_life_hours = 3.0,
  simvastatin.standard_dose_mg = 20.0,
  simvastatin.therapeutic_class = "HMG-CoA Reductase Inhibitor (Statin)";

MERGE (metformin:Medication {rxnorm_id: "6809"})
ON CREATE SET
  metformin.name = "Metformin",
  metformin.half_life_hours = 6.2,
  metformin.standard_dose_mg = 1000.0,
  metformin.therapeutic_class = "Biguanide Antidiabetic";

MERGE (glipizide:Medication {rxnorm_id: "4821"})
ON CREATE SET
  glipizide.name = "Glipizide",
  glipizide.half_life_hours = 4.0,
  glipizide.standard_dose_mg = 10.0,
  glipizide.therapeutic_class = "Sulfonylurea Antidiabetic";

MERGE (clopidogrel:Medication {rxnorm_id: "32968"})
ON CREATE SET
  clopidogrel.name = "Clopidogrel",
  clopidogrel.half_life_hours = 6.0,
  clopidogrel.standard_dose_mg = 75.0,
  clopidogrel.therapeutic_class = "P2Y12 Platelet Inhibitor";

MERGE (omeprazole:Medication {rxnorm_id: "7646"})
ON CREATE SET
  omeprazole.name = "Omeprazole",
  omeprazole.half_life_hours = 1.0,
  omeprazole.standard_dose_mg = 20.0,
  omeprazole.therapeutic_class = "Proton Pump Inhibitor (PPI)";

MERGE (fluconazole:Medication {rxnorm_id: "4492"})
ON CREATE SET
  fluconazole.name = "Fluconazole",
  fluconazole.half_life_hours = 30.0,
  fluconazole.standard_dose_mg = 150.0,
  fluconazole.therapeutic_class = "Triazole Antifungal";

// ------------------------------------------------------------------------------
// 6. Pharmacodynamic Relationships: (:Medication)-[:MODULATES]->(:TargetBiomarker)
// ------------------------------------------------------------------------------

MERGE (lisinopril)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -10.5,
  confidence: 0.95,
  evidence: "FDA Label / SPRINT Trial"
}]->(sbp);

MERGE (losartan)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -8.0,
  confidence: 0.92,
  evidence: "LIFE Trial / FDA Label"
}]->(sbp);

MERGE (amlodipine)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -12.0,
  confidence: 0.96,
  evidence: "ALLHAT Trial"
}]->(sbp);

MERGE (metformin)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -1.3,
  confidence: 0.98,
  evidence: "UKPDS Trial"
}]->(hba1c);

MERGE (glipizide)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -1.0,
  confidence: 0.90,
  evidence: "ADA Standards of Care"
}]->(hba1c);

MERGE (atorvastatin)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -42.0,
  confidence: 0.97,
  evidence: "ASCOT-LLA / ACC/AHA Guidelines"
}]->(ldlc);

MERGE (simvastatin)-[:MODULATES {
  direction: "DECREASE",
  expected_delta_per_standard_dose: -34.0,
  confidence: 0.95,
  evidence: "4S Trial"
}]->(ldlc);

// ------------------------------------------------------------------------------
// 7. Pharmacokinetic Metabolic Clearance: (:Medication)-[:METABOLIZED_BY]->(:ClearancePathway)
// ------------------------------------------------------------------------------

MERGE (atorvastatin)-[:METABOLIZED_BY {
  substrate_affinity: "HIGH",
  clearance_fraction: 0.85
}]->(cyp3a4);

MERGE (simvastatin)-[:METABOLIZED_BY {
  substrate_affinity: "VERY_HIGH",
  clearance_fraction: 0.90
}]->(cyp3a4);

MERGE (amlodipine)-[:METABOLIZED_BY {
  substrate_affinity: "MODERATE",
  clearance_fraction: 0.60
}]->(cyp3a4);

MERGE (losartan)-[:METABOLIZED_BY {
  substrate_affinity: "HIGH",
  clearance_fraction: 0.65
}]->(cyp2c9);

MERGE (losartan)-[:METABOLIZED_BY {
  substrate_affinity: "MODERATE",
  clearance_fraction: 0.35
}]->(cyp3a4);

MERGE (glipizide)-[:METABOLIZED_BY {
  substrate_affinity: "HIGH",
  clearance_fraction: 0.80
}]->(cyp2c9);

MERGE (clopidogrel)-[:METABOLIZED_BY {
  substrate_affinity: "HIGH",
  clearance_fraction: 0.70,
  bioactivation_required: true // Prodrug converted to active metabolite
}]->(cyp2c19);

MERGE (lisinopril)-[:METABOLIZED_BY {
  substrate_affinity: "DIRECT_ELIMINATION",
  clearance_fraction: 1.00
}]->(renal);

MERGE (metformin)-[:METABOLIZED_BY {
  substrate_affinity: "DIRECT_ELIMINATION",
  clearance_fraction: 1.00
}]->(renal);

// ------------------------------------------------------------------------------
// 8. Enzymatic Inhibition (Drug Friction): (:Medication)-[:INHIBITS]->(:ClearancePathway)
// ------------------------------------------------------------------------------

// Fluconazole is a potent inhibitor of CYP2C9 and CYP3A4
MERGE (fluconazole)-[:INHIBITS {
  inhibition_potency: "STRONG",
  ki_micromolar: 0.3,
  clinical_effect: "Significantly decreases clearance of CYP2C9 and CYP3A4 substrates, multiplying serum exposure"
}]->(cyp2c9);

MERGE (fluconazole)-[:INHIBITS {
  inhibition_potency: "MODERATE",
  ki_micromolar: 2.1,
  clinical_effect: "Increases exposure to CYP3A4 substrates"
}]->(cyp3a4);

// Omeprazole inhibits CYP2C19 (blocking Clopidogrel bioactivation)
MERGE (omeprazole)-[:INHIBITS {
  inhibition_potency: "STRONG",
  ki_micromolar: 1.5,
  clinical_effect: "Blocks bioactivation of clopidogrel, severely blunting antiplatelet response"
}]->(cyp2c19);

// Amlodipine exerts weak-to-moderate inhibition on CYP3A4 (further compounding Statin competition)
MERGE (amlodipine)-[:INHIBITS {
  inhibition_potency: "WEAK",
  ki_micromolar: 12.0,
  clinical_effect: "Can increase Simvastatin/Atorvastatin Cmax by 30-70%"
}]->(cyp3a4);

// ------------------------------------------------------------------------------
// 9. Clinical Indications: (:Medication)-[:INDICATED_FOR]->(:Condition)
// ------------------------------------------------------------------------------

MERGE (lisinopril)-[:INDICATED_FOR]->(htn);
MERGE (losartan)-[:INDICATED_FOR]->(htn);
MERGE (amlodipine)-[:INDICATED_FOR]->(htn);
MERGE (metformin)-[:INDICATED_FOR]->(t2d);
MERGE (glipizide)-[:INDICATED_FOR]->(t2d);
MERGE (atorvastatin)-[:INDICATED_FOR]->(hyperlip);
MERGE (atorvastatin)-[:INDICATED_FOR]->(cad);
MERGE (simvastatin)-[:INDICATED_FOR]->(hyperlip);
MERGE (clopidogrel)-[:INDICATED_FOR]->(cad);
