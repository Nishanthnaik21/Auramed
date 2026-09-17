use crate::models::{
    ClaimsDispensePayload, DeidentifiedDispenseEvent, DeidentifiedEncounterEvent,
    DeidentifiedObservationEvent, FhirEncounter, FhirMedicationDispense, FhirObservation,
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::fmt;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug)]
pub enum DeidError {
    MissingPatientIdentifier(String),
    MissingRequiredClinicalField(String),
    CryptoError(String),
}

impl fmt::Display for DeidError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DeidError::MissingPatientIdentifier(msg) => {
                write!(f, "De-identification failed: missing patient identifier - {}", msg)
            }
            DeidError::MissingRequiredClinicalField(msg) => {
                write!(f, "De-identification failed: missing clinical field - {}", msg)
            }
            DeidError::CryptoError(msg) => write!(f, "Cryptographic pseudonymization error: {}", msg),
        }
    }
}

impl std::error::Error for DeidError {}

#[derive(Clone)]
pub struct Pseudonymizer {
    master_secret: Vec<u8>,
    salt: Vec<u8>,
}

impl Pseudonymizer {
    pub fn new(master_secret: Vec<u8>, salt: Vec<u8>) -> Self {
        Self { master_secret, salt }
    }

    /// Computes deterministic salted HMAC-SHA256 pseudonym for any direct identifier.
    /// Format: lowercase 64-character hexadecimal digest.
    pub fn tokenize(&self, raw_identifier: &str) -> Result<String, DeidError> {
        let trimmed = raw_identifier.trim();
        if trimmed.is_empty() {
            return Err(DeidError::MissingPatientIdentifier("Raw identifier is empty".to_string()));
        }

        let mut mac = HmacSha256::new_from_slice(&self.master_secret)
            .map_err(|e| DeidError::CryptoError(format!("HMAC init failure: {}", e)))?;

        // Feed salt prefix first to prevent length extension and rainbow table matching
        mac.update(&self.salt);
        mac.update(trimmed.as_bytes());

        let result = mac.finalize();
        Ok(hex::encode(result.into_bytes()))
    }

    /// Extracts patient identifier from FHIR subject reference (e.g., "Patient/1029384")
    /// or identifiers list, returning the tokenized pseudonym.
    pub fn resolve_patient_token(
        &self,
        subject_ref: &Option<crate::models::Reference>,
        identifiers: &Option<Vec<crate::models::Identifier>>,
    ) -> Result<String, DeidError> {
        // Priority 1: Subject reference
        if let Some(ref s) = subject_ref {
            if let Some(ref r) = s.reference {
                let id_part = r.strip_prefix("Patient/").unwrap_or(r.as_str());
                if !id_part.trim().is_empty() {
                    return self.tokenize(id_part);
                }
            }
        }

        // Priority 2: Inbound identifier (MRN, SSN, etc.)
        if let Some(ref id_list) = identifiers {
            for id in id_list {
                if let Some(ref val) = id.value {
                    if !val.trim().is_empty() {
                        return self.tokenize(val);
                    }
                }
            }
        }

        Err(DeidError::MissingPatientIdentifier(
            "Neither subject.reference nor identifier provided for patient entity".to_string(),
        ))
    }
}

/// De-identify FHIR R4 MedicationDispense into zero-PHI stream event
pub fn deidentify_medication_dispense(
    dispense: FhirMedicationDispense,
    pseudonymizer: &Pseudonymizer,
) -> Result<DeidentifiedDispenseEvent, DeidError> {
    let patient_token = pseudonymizer.resolve_patient_token(&dispense.subject, &dispense.identifier)?;

    let medication_code = dispense
        .medication_codeable_concept
        .as_ref()
        .and_then(|c| c.coding.as_ref())
        .and_then(|codings| codings.first())
        .and_then(|c| c.code.clone())
        .unwrap_or_else(|| "UNKNOWN_NDC".to_string());

    let medication_display = dispense
        .medication_codeable_concept
        .as_ref()
        .and_then(|c| c.text.clone().or_else(|| {
            c.coding.as_ref().and_then(|list| list.first()).and_then(|item| item.display.clone())
        }))
        .unwrap_or_else(|| "Prescription Medication".to_string());

    let days_supply = dispense
        .days_supply
        .as_ref()
        .and_then(|q| q.value)
        .map(|v| v as u32)
        .unwrap_or(30);

    let quantity = dispense
        .quantity
        .as_ref()
        .and_then(|q| q.value)
        .unwrap_or(days_supply as f64);

    let fill_date = dispense
        .when_handed_over
        .or(dispense.when_prepared)
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    Ok(DeidentifiedDispenseEvent {
        event_id: Uuid::new_v4().to_string(),
        patient_token,
        medication_code,
        medication_display,
        fill_date,
        days_supply,
        quantity,
        ingested_at: Utc::now(),
    })
}

/// De-identify FHIR R4 Observation (Biomarkers like Systolic Blood Pressure, HbA1c)
pub fn deidentify_observation(
    observation: FhirObservation,
    pseudonymizer: &Pseudonymizer,
) -> Result<Vec<DeidentifiedObservationEvent>, DeidError> {
    let patient_token = pseudonymizer.resolve_patient_token(&observation.subject, &observation.identifier)?;
    let effective_time = observation
        .effective_date_time
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let mut events = Vec::new();

    // Check primary valueQuantity
    if let Some(val_q) = &observation.value_quantity {
        if let Some(val) = val_q.value {
            let (system, code, display) = extract_coding(&observation.code);
            events.push(DeidentifiedObservationEvent {
                event_id: Uuid::new_v4().to_string(),
                patient_token: patient_token.clone(),
                code_system: system,
                loinc_code: code,
                code_display: display,
                measurement_value: val,
                measurement_unit: val_q.unit.clone().unwrap_or_default(),
                effective_time: effective_time.clone(),
                ingested_at: Utc::now(),
            });
        }
    }

    // Check multi-component observations (e.g., Blood Pressure panel LOINC 85354-9 with SBP component 8480-6)
    if let Some(components) = observation.component {
        for comp in components {
            if let Some(val_q) = comp.value_quantity {
                if let Some(val) = val_q.value {
                    let (system, code, display) = extract_coding(&comp.code);
                    events.push(DeidentifiedObservationEvent {
                        event_id: Uuid::new_v4().to_string(),
                        patient_token: patient_token.clone(),
                        code_system: system,
                        loinc_code: code,
                        code_display: display,
                        measurement_value: val,
                        measurement_unit: val_q.unit.unwrap_or_default(),
                        effective_time: effective_time.clone(),
                        ingested_at: Utc::now(),
                    });
                }
            }
        }
    }

    if events.is_empty() {
        return Err(DeidError::MissingRequiredClinicalField(
            "Observation has no numeric valueQuantity or component values".to_string(),
        ));
    }

    Ok(events)
}

/// De-identify FHIR R4 Encounter
pub fn deidentify_encounter(
    encounter: FhirEncounter,
    pseudonymizer: &Pseudonymizer,
) -> Result<DeidentifiedEncounterEvent, DeidError> {
    let patient_token = pseudonymizer.resolve_patient_token(&encounter.subject, &encounter.identifier)?;

    let (start_time, end_time) = match encounter.period {
        Some(p) => (p.start, p.end),
        None => (None, None),
    };

    Ok(DeidentifiedEncounterEvent {
        event_id: Uuid::new_v4().to_string(),
        patient_token,
        encounter_class: encounter.status,
        start_time,
        end_time,
        ingested_at: Utc::now(),
    })
}

/// De-identify raw pharmacy claims payload (stripping MRN, SSN, Legal Name, Address, Prescriber NPI)
pub fn deidentify_claims(
    claims: ClaimsDispensePayload,
    pseudonymizer: &Pseudonymizer,
) -> Result<DeidentifiedDispenseEvent, DeidError> {
    // Generate deterministic patient_token from raw MRN
    let patient_token = pseudonymizer.tokenize(&claims.mrn)?;

    Ok(DeidentifiedDispenseEvent {
        event_id: Uuid::new_v4().to_string(),
        patient_token,
        medication_code: claims.ndc_code,
        medication_display: claims.medication_name,
        fill_date: claims.fill_date,
        days_supply: claims.days_supply,
        quantity: claims.quantity_dispensed,
        ingested_at: Utc::now(),
    })
}

fn extract_coding(codeable: &crate::models::CodeableConcept) -> (String, String, String) {
    if let Some(ref codings) = codeable.coding {
        if let Some(first) = codings.first() {
            return (
                first.system.clone().unwrap_or_else(|| "http://loinc.org".to_string()),
                first.code.clone().unwrap_or_else(|| "UNKNOWN".to_string()),
                first.display.clone().or_else(|| codeable.text.clone()).unwrap_or_default(),
            );
        }
    }
    ("http://loinc.org".to_string(), "UNKNOWN".to_string(), codeable.text.clone().unwrap_or_default())
}
