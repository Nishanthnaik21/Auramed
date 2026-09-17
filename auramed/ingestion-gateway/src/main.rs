mod config;
mod deid;
mod handlers;
mod kafka;
mod models;

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::AppConfig;
use crate::deid::Pseudonymizer;
use crate::handlers::{
    health_check, ingest_claims, ingest_encounter, ingest_medication_dispense, ingest_observation,
    AppState,
};
use crate::kafka::KafkaDispatcher;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured JSON tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "auramed_ingestion_gateway=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    info!("Starting AuraMed Ingestion Gateway...");

    let config = AppConfig::from_env().map_err(|e| {
        tracing::error!("Configuration error: {}", e);
        e
    })?;

    info!(
        server_host = %config.server_host,
        server_port = %config.server_port,
        kafka_brokers = %config.kafka_brokers,
        "Loaded runtime configuration"
    );

    let pseudonymizer = Pseudonymizer::new(
        config.hmac_master_secret.clone(),
        config.hmac_salt.clone(),
    );

    let kafka = KafkaDispatcher::new(&config.kafka_brokers).map_err(|e| {
        tracing::error!("Failed to initialize Kafka dispatcher: {}", e);
        e
    })?;

    let state = Arc::new(AppState {
        config: config.clone(),
        pseudonymizer,
        kafka,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/fhir/MedicationDispense", post(ingest_medication_dispense))
        .route("/api/v1/fhir/Observation", post(ingest_observation))
        .route("/api/v1/fhir/Encounter", post(ingest_encounter))
        .route("/api/v1/claims", post(ingest_claims))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::new(
        config.server_host.parse()?,
        config.server_port,
    );

    info!("AuraMed Ingestion Gateway listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("AuraMed Ingestion Gateway shutdown complete");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C signal handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received SIGINT (Ctrl+C), starting graceful shutdown...");
        },
        _ = terminate => {
            info!("Received SIGTERM, starting graceful shutdown...");
        },
    }
}
