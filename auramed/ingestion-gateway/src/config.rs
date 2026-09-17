use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub server_host: String,
    pub server_port: u16,
    pub kafka_brokers: String,
    pub topic_dispense: String,
    pub topic_observations: String,
    pub topic_encounters: String,
    pub hmac_master_secret: Vec<u8>,
    pub hmac_salt: Vec<u8>,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, String> {
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let server_port = env::var("SERVER_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|e| format!("Invalid SERVER_PORT: {}", e))?;

        let kafka_brokers = env::var("KAFKA_BROKERS")
            .unwrap_or_else(|_| "localhost:9092".to_string());

        let topic_dispense = env::var("TOPIC_DISPENSE")
            .unwrap_or_else(|_| "telemetry.claims.dispense".to_string());

        let topic_observations = env::var("TOPIC_OBSERVATIONS")
            .unwrap_or_else(|_| "telemetry.clinical.observations".to_string());

        let topic_encounters = env::var("TOPIC_ENCOUNTERS")
            .unwrap_or_else(|_| "telemetry.clinical.encounters".to_string());

        // In production, the master secret MUST be provided securely via Vault/KMS/Env.
        // Minimum 32 bytes (256 bits) for HMAC-SHA256 security standard.
        let secret_str = env::var("AURAMED_MASTER_SECRET").unwrap_or_else(|_| {
            "aura-med-production-insecure-default-master-key-must-be-rotated-32b!".to_string()
        });

        if secret_str.len() < 32 {
            return Err("AURAMED_MASTER_SECRET must be at least 32 characters in length for cryptographic security".to_string());
        }

        let salt_str = env::var("AURAMED_SALT")
            .unwrap_or_else(|_| "auramed_phi_pepper_2026_v1".to_string());

        Ok(Self {
            server_host,
            server_port,
            kafka_brokers,
            topic_dispense,
            topic_observations,
            topic_encounters,
            hmac_master_secret: secret_str.into_bytes(),
            hmac_salt: salt_str.into_bytes(),
        })
    }
}
