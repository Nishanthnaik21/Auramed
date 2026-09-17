use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::util::Timeout;
use serde::Serialize;
use std::time::Duration;
use tracing::{error, info};

#[derive(Clone)]
pub struct KafkaDispatcher {
    producer: FutureProducer,
}

impl KafkaDispatcher {
    pub fn new(brokers: &str) -> Result<Self, String> {
        info!("Initializing Kafka FutureProducer for brokers: {}", brokers);
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .set("queue.buffering.max.messages", "100000")
            .set("queue.buffering.max.ms", "5")
            .set("compression.type", "lz4")
            .set("acks", "all")
            .set("enable.idempotence", "true")
            .create()
            .map_err(|e| format!("Failed to create Kafka producer: {}", e))?;

        Ok(Self { producer })
    }

    /// Asynchronously send de-identified payload to Kafka, partitioned by patient_token
    pub async fn dispatch<T: Serialize>(
        &self,
        topic: &str,
        patient_token: &str,
        payload: &T,
    ) -> Result<(), String> {
        let serialized = serde_json::to_string(payload)
            .map_err(|e| format!("Serialization error: {}", e))?;

        let record = FutureRecord::to(topic)
            .key(patient_token)
            .payload(&serialized);

        match self
            .producer
            .send(record, Timeout::After(Duration::from_secs(5)))
            .await
        {
            Ok((partition, offset)) => {
                tracing::debug!(
                    topic = topic,
                    partition = partition,
                    offset = offset,
                    patient_token = patient_token,
                    "Dispatched de-identified event to Kafka"
                );
                Ok(())
            }
            Err((e, _)) => {
                error!(
                    error = %e,
                    topic = topic,
                    patient_token = patient_token,
                    "Failed to deliver record to Kafka"
                );
                Err(format!("Kafka delivery error: {}", e))
            }
        }
    }
}
