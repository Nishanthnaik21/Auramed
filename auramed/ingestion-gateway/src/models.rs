use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Generic FHIR Reference (e.g. "Patient/12345")
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Reference {
    pub reference: Option<String>,
    pub display: Option<String>,
}

/// FHIR Identifier (e.g. MRN, SSN, DL)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Identifier {
    #[serde(rename = "use")]
    pub use_type: Option<String>,
    pub system: Option<String>,
    pub value: Option<String>,
}

/// FHIR Coding
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Coding {
    pub system: Option<String>,
    pub code: Option<String>,
    pub display: Option<String>,
}

/// FHIR CodeableConcept
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeableConcept {
    pub coding: Option<Vec<Coding>>,
    pub text: Option<String>,
}

/// FHIR Quantity
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Quantity {
    pub value: Option<f64>,
    pub unit: Option<String>,
    pub system: Option<String>,
    pub code: Option<String>,
}

/// Inbound FHIR R4 MedicationDispense
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FhirMedicationDispense {
    #[serde(rename = "resourceType")]
    pub resource_type: String,
    pub id: Option<String>,
    pub identifier: Option<Vec<Identifier>>,
    pub status: String,
    pub subject: Option<Reference>,
    #[serde(rename = "medicationCodeableConcept")]
    pub medication_codeable_concept: Option<CodeableConcept>,
    pub quantity: Option<Quantity>,
    #[serde(rename = "daysSupply")]
    pub days_supply: Option<Quantity>,
    #[serde(rename = "whenHandedOver")]
    pub when_handed_over: Option<String>,
    #[serde(rename = "whenPrepared")]
    pub when_prepared: Option<String>,
    // PII fields that must be scrubbed:
    pub performer: Option<serde_json::Value>,
    pub receiver: Option<serde_json::Value>,
    pub note: Option<serde_json::Value>,
}

/// Inbound FHIR R4 Observation (Biomarker, Blood Pressure, HbA1c, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FhirObservation {
    #[serde(rename = "resourceType")]
    pub resource_type: String,
    pub id: Option<String>,
    pub identifier: Option<Vec<Identifier>>,
    pub status: String,
    pub code: CodeableConcept,
    pub subject: Option<Reference>,
    #[serde(rename = "effectiveDateTime")]
    pub effective_date_time: Option<String>,
    #[serde(rename = "valueQuantity")]
    pub value_quantity: Option<Quantity>,
    pub component: Option<Vec<ObservationComponent>>,
    // PII fields that must be scrubbed:
    pub performer: Option<serde_json::Value>,
    pub note: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationComponent {
    pub code: CodeableConcept,
    #[serde(rename = "valueQuantity")]
    pub value_quantity: Option<Quantity>,
}

/// Inbound FHIR R4 Encounter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FhirEncounter {
    #[serde(rename = "resourceType")]
    pub resource_type: String,
    pub id: Option<String>,
    pub identifier: Option<Vec<Identifier>>,
    pub status: String,
    pub subject: Option<Reference>,
    pub period: Option<EncounterPeriod>,
    pub reason_code: Option<Vec<CodeableConcept>>,
    // PII fields:
    pub participant: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncounterPeriod {
    pub start: Option<String>,
    pub end: Option<String>,
}

/// Inbound Raw Pharmacy Claims Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimsDispensePayload {
    pub claim_id: String,
    pub mrn: String,
    pub ssn: Option<String>,
    pub patient_first_name: Option<String>,
    pub patient_last_name: Option<String>,
    pub patient_dob: Option<String>,
    pub patient_address: Option<String>,
    pub ndc_code: String,
    pub medication_name: String,
    pub fill_date: String,
    pub days_supply: u32,
    pub quantity_dispensed: f64,
    pub prescriber_npi: Option<String>,
    pub pharmacy_npi: Option<String>,
}

// ---------------------------------------------------------------------------
// De-Identified Outbound Kafka Telemetry Payloads (Zero-PHI Guarantee)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeidentifiedDispenseEvent {
    pub event_id: String,
    pub patient_token: String,
    pub medication_code: String,
    pub medication_display: String,
    pub fill_date: String,
    pub days_supply: u32,
    pub quantity: f64,
    pub ingested_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeidentifiedObservationEvent {
    pub event_id: String,
    pub patient_token: String,
    pub code_system: String,
    pub loinc_code: String,
    pub code_display: String,
    pub measurement_value: f64,
    pub measurement_unit: String,
    pub effective_time: String,
    pub ingested_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeidentifiedEncounterEvent {
    pub event_id: String,
    pub patient_token: String,
    pub encounter_class: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub ingested_at: DateTime<Utc>,
}
