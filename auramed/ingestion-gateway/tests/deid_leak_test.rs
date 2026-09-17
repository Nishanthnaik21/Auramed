use auramed_ingestion_gateway::deid::{
    deidentify_claims, deidentify_medication_dispense, deidentify_observation, Pseudonymizer,
};
use auramed_ingestion_gateway::models::{
    ClaimsDispensePayload, CodeableConcept, Coding, FhirMedicationDispense, FhirObservation,
    Identifier, Quantity, Reference,
};
use serde_json::json;

fn setup_test_pseudonymizer() -> Pseudonymizer {
    let secret = b"unit-test-master-secret-32-bytes-long!".to_vec();
    let salt = b"unit-test-salt-pepper".to_vec();
    Pseudonymizer::new(secret, salt)
}

#[test]
fn test_pseudonymizer_determinism_and_uniqueness() {
    let deid = setup_test_pseudonymizer();

    let mrn1 = "MRN-10029384";
    let mrn2 = "MRN-10029385";

    let token1_a = deid.tokenize(mrn1).expect("Tokenization failed");
    let token1_b = deid.tokenize(mrn1).expect("Tokenization failed");
    let token2 = deid.tokenize(mrn2).expect("Tokenization failed");

    // Deterministic: Identical inputs yield identical tokens
    assert_eq!(token1_a, token1_b);
    assert_eq!(token1_a.len(), 64); // 32-byte hex string is 64 chars

    // Unique: Different inputs yield completely different tokens
    assert_ne!(token1_a, token2);
}

#[test]
fn test_zero_phi_leak_on_medication_dispense() {
    let deid = setup_test_pseudonymizer();

    let raw_mrn = "MRN-ALICE-998877";
    let raw_name = "Alice Wonder";
    let raw_address = "456 Oak Avenue, Springfield";
    let raw_performer = "Dr. Robert Vance, MD";

    let dispense = FhirMedicationDispense {
        resource_type: "MedicationDispense".to_string(),
        id: Some("dispense-xyz-123".to_string()),
        identifier: Some(vec![Identifier {
            use_type: Some("official".to_string()),
            system: Some("http://hospital.org/mrn".to_string()),
            value: Some(raw_mrn.to_string()),
        }]),
        status: "completed".to_string(),
        subject: Some(Reference {
            reference: Some(format!("Patient/{}", raw_mrn)),
            display: Some(raw_name.to_string()),
        }),
        medication_codeable_concept: Some(CodeableConcept {
            coding: Some(vec![Coding {
                system: Some("http://hl7.org/fhir/sid/ndc".to_string()),
                code: Some("00002-3228-30".to_string()),
                display: Some("Lisinopril 10 MG Oral Tablet".to_string()),
            }]),
            text: Some("Lisinopril 10 MG Oral Tablet".to_string()),
        }),
        quantity: Some(Quantity {
            value: Some(30.0),
            unit: Some("TAB".to_string()),
            system: Some("http://unitsofmeasure.org".to_string()),
            code: Some("TAB".to_string()),
        }),
        days_supply: Some(Quantity {
            value: Some(30.0),
            unit: Some("d".to_string()),
            system: Some("http://unitsofmeasure.org".to_string()),
            code: Some("d".to_string()),
        }),
        when_handed_over: Some("2026-03-01T10:00:00Z".to_string()),
        when_prepared: Some("2026-03-01T09:00:00Z".to_string()),
        performer: Some(json!([{"actor": {"display": raw_performer}}])),
        receiver: Some(json!([{"display": raw_name, "address": raw_address}])),
        note: Some(json!([{"text": format!("Confidential: Deliver to {}", raw_address)}])),
    };

    let result = deidentify_medication_dispense(dispense, &deid)
        .expect("Deidentification should succeed");

    // Serialize what will be published to Kafka
    let kafka_payload_json = serde_json::to_string_pretty(&result)
        .expect("Serialization should succeed");

    // Critical assertion: NO raw MRN, Name, Address, or Doctor Name appears anywhere in the serialized payload
    assert!(
        !kafka_payload_json.contains(raw_mrn),
        "CRITICAL LEAK: Raw MRN found in Kafka payload!"
    );
    assert!(
        !kafka_payload_json.contains(raw_name),
        "CRITICAL LEAK: Patient legal name found in Kafka payload!"
    );
    assert!(
        !kafka_payload_json.contains(raw_address),
        "CRITICAL LEAK: Patient address found in Kafka payload!"
    );
    assert!(
        !kafka_payload_json.contains(raw_performer),
        "CRITICAL LEAK: Clinician name found in Kafka payload!"
    );
    assert!(
        !kafka_payload_json.contains("Patient/"),
        "Raw FHIR patient resource reference found in Kafka payload!"
    );

    // Patient token must be the HMAC hash
    let expected_token = deid.tokenize(raw_mrn).unwrap();
    assert_eq!(result.patient_token, expected_token);
    assert_eq!(result.medication_code, "00002-3228-30");
    assert_eq!(result.days_supply, 30);
}

#[test]
fn test_zero_phi_leak_on_claims_payload() {
    let deid = setup_test_pseudonymizer();

    let raw_ssn = "999-12-3456";
    let raw_mrn = "MRN-CLAIM-8849";
    let raw_first = "Jonathan";
    let raw_last = "Doe";
    let raw_dob = "1975-08-14";
    let raw_address = "742 Evergreen Terrace, Springfield";

    let claim = ClaimsDispensePayload {
        claim_id: "CLM-2026-90991".to_string(),
        mrn: raw_mrn.to_string(),
        ssn: Some(raw_ssn.to_string()),
        patient_first_name: Some(raw_first.to_string()),
        patient_last_name: Some(raw_last.to_string()),
        patient_dob: Some(raw_dob.to_string()),
        patient_address: Some(raw_address.to_string()),
        ndc_code: "00069-4200-30".to_string(),
        medication_name: "Atorvastatin 20mg".to_string(),
        fill_date: "2026-02-15T08:30:00Z".to_string(),
        days_supply: 90,
        quantity_dispensed: 90.0,
        prescriber_npi: Some("1992837465".to_string()),
        pharmacy_npi: Some("1102938475".to_string()),
    };

    let result = deidentify_claims(claim, &deid).expect("De-identification should succeed");
    let kafka_payload_json = serde_json::to_string_pretty(&result).unwrap();

    assert!(!kafka_payload_json.contains(raw_ssn), "LEAK: SSN found in payload!");
    assert!(!kafka_payload_json.contains(raw_mrn), "LEAK: MRN found in payload!");
    assert!(!kafka_payload_json.contains(raw_first), "LEAK: First name found in payload!");
    assert!(!kafka_payload_json.contains(raw_last), "LEAK: Last name found in payload!");
    assert!(!kafka_payload_json.contains(raw_dob), "LEAK: DOB found in payload!");
    assert!(!kafka_payload_json.contains(raw_address), "LEAK: Address found in payload!");

    let expected_token = deid.tokenize(raw_mrn).unwrap();
    assert_eq!(result.patient_token, expected_token);
    assert_eq!(result.days_supply, 90);
}

#[test]
fn test_zero_phi_leak_on_observation_biomarkers() {
    let deid = setup_test_pseudonymizer();

    let raw_patient_id = "MRN-OBS-774411";
    let raw_clinician = "Dr. Meredith Grey";

    let obs = FhirObservation {
        resource_type: "Observation".to_string(),
        id: Some("obs-sbp-1".to_string()),
        identifier: None,
        status: "final".to_string(),
        code: CodeableConcept {
            coding: Some(vec![Coding {
                system: Some("http://loinc.org".to_string()),
                code: Some("8480-6".to_string()),
                display: Some("Systolic blood pressure".to_string()),
            }]),
            text: Some("Systolic Blood Pressure".to_string()),
        },
        subject: Some(Reference {
            reference: Some(format!("Patient/{}", raw_patient_id)),
            display: Some("Secret Patient Name".to_string()),
        }),
        effective_date_time: Some("2026-03-10T14:30:00Z".to_string()),
        value_quantity: Some(Quantity {
            value: Some(132.0),
            unit: Some("mm[Hg]".to_string()),
            system: Some("http://unitsofmeasure.org".to_string()),
            code: Some("mm[Hg]".to_string()),
        }),
        component: None,
        performer: Some(json!([{"display": raw_clinician}])),
        note: Some(json!([{"text": "Patient felt dizzy upon arrival"}])),
    };

    let events = deidentify_observation(obs, &deid).expect("De-identification must succeed");
    assert_eq!(events.len(), 1);

    let kafka_payload_json = serde_json::to_string(&events[0]).unwrap();

    assert!(!kafka_payload_json.contains(raw_patient_id));
    assert!(!kafka_payload_json.contains(raw_clinician));
    assert!(!kafka_payload_json.contains("Secret Patient Name"));
    assert!(!kafka_payload_json.contains("dizzy"));

    assert_eq!(events[0].loinc_code, "8480-6");
    assert_eq!(events[0].measurement_value, 132.0);
}
