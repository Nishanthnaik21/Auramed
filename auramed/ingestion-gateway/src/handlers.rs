use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde_json::json;
use std::sync::Arc;
use tracing::{error, info, instrument};

use crate::config::AppConfig;
use crate::deid::{
    deidentify_claims, deidentify_encounter, deidentify_medication_dispense,
    deidentify_observation, Pseudonymizer,
};
use crate::kafka::KafkaDispatcher;
use crate::models::{ClaimsDispensePayload, FhirEncounter, FhirMedicationDispense, FhirObservation};

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub pseudonymizer: Pseudonymizer,
    pub kafka: KafkaDispatcher,
}

/// Health check endpoint for Kubernetes liveness/readiness probes
pub async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "status": "UP", "tier": "auramed-ingestion-gateway" })))
}

/// Ingest FHIR R4 MedicationDispense resource
#[instrument(skip(state, payload), fields(resource = "MedicationDispense"))]
pub async fn ingest_medication_dispense(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<FhirMedicationDispense>,
) -> impl IntoResponse {
    let deidentified = match deidentify_medication_dispense(payload, &state.pseudonymizer) {
        Ok(event) => event,
        Err(e) => {
            error!("De-identification failure on MedicationDispense: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "De-identification failed", "details": e.to_string() })),
            );
        }
    };

    let event_id = deidentified.event_id.clone();
    let patient_token = deidentified.patient_token.clone();

    if let Err(e) = state
        .kafka
        .dispatch(&state.config.topic_dispense, &patient_token, &deidentified)
        .await
    {
        error!("Kafka dispatch error: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Streaming broker dispatch failure", "details": e })),
        );
    }

    info!(event_id = %event_id, patient_token = %patient_token, "Dispense ingested and queued");
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "INGESTED",
            "event_id": event_id,
            "patient_token": patient_token,
            "topic": state.config.topic_dispense
        })),
    )
}

/// Ingest FHIR R4 Observation resource (SBP, HbA1c, etc.)
#[instrument(skip(state, payload), fields(resource = "Observation"))]
pub async fn ingest_observation(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<FhirObservation>,
) -> impl IntoResponse {
    let events = match deidentify_observation(payload, &state.pseudonymizer) {
        Ok(evts) => evts,
        Err(e) => {
            error!("De-identification failure on Observation: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "De-identification failed", "details": e.to_string() })),
            );
        }
    };

    let mut ingested_ids = Vec::new();
    let mut patient_token = String::new();

    for event in &events {
        patient_token = event.patient_token.clone();
        if let Err(e) = state
            .kafka
            .dispatch(&state.config.topic_observations, &patient_token, event)
            .await
        {
            error!("Kafka dispatch error on observation component: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Streaming broker dispatch failure", "details": e })),
            );
        }
        ingested_ids.push(event.event_id.clone());
    }

    info!(count = events.len(), patient_token = %patient_token, "Observations ingested and queued");
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "INGESTED",
            "event_ids": ingested_ids,
            "patient_token": patient_token,
            "topic": state.config.topic_observations
        })),
    )
}

/// Ingest FHIR R4 Encounter resource
#[instrument(skip(state, payload), fields(resource = "Encounter"))]
pub async fn ingest_encounter(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<FhirEncounter>,
) -> impl IntoResponse {
    let event = match deidentify_encounter(payload, &state.pseudonymizer) {
        Ok(evt) => evt,
        Err(e) => {
            error!("De-identification failure on Encounter: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "De-identification failed", "details": e.to_string() })),
            );
        }
    };

    let event_id = event.event_id.clone();
    let patient_token = event.patient_token.clone();

    if let Err(e) = state
        .kafka
        .dispatch(&state.config.topic_encounters, &patient_token, &event)
        .await
    {
        error!("Kafka dispatch error on encounter: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Streaming broker dispatch failure", "details": e })),
        );
    }

    info!(event_id = %event_id, patient_token = %patient_token, "Encounter ingested and queued");
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "INGESTED",
            "event_id": event_id,
            "patient_token": patient_token,
            "topic": state.config.topic_encounters
        })),
    )
}

/// Ingest raw pharmacy claims payload
#[instrument(skip(state, payload), fields(resource = "Claims"))]
pub async fn ingest_claims(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ClaimsDispensePayload>,
) -> impl IntoResponse {
    let event = match deidentify_claims(payload, &state.pseudonymizer) {
        Ok(evt) => evt,
        Err(e) => {
            error!("De-identification failure on Claims: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "De-identification failed", "details": e.to_string() })),
            );
        }
    };

    let event_id = event.event_id.clone();
    let patient_token = event.patient_token.clone();

    if let Err(e) = state
        .kafka
        .dispatch(&state.config.topic_dispense, &patient_token, &event)
        .await
    {
        error!("Kafka dispatch error on claims: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Streaming broker dispatch failure", "details": e })),
        );
    }

    info!(event_id = %event_id, patient_token = %patient_token, "Claims dispense ingested and queued");
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "INGESTED",
            "event_id": event_id,
            "patient_token": patient_token,
            "topic": state.config.topic_dispense
        })),
    )
}
