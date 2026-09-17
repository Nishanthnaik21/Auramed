package org.auramed.streaming;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.eventtime.SerializableTimestampAssigner;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.CheckpointingMode;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.CheckpointConfig;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.windowing.assigners.SlidingEventTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.auramed.streaming.model.AuraMedEvent;
import org.auramed.streaming.model.DispenseRecord;
import org.auramed.streaming.model.ObservationRecord;
import org.auramed.streaming.model.PatientFeatureVector;
import org.auramed.streaming.sink.IcebergHistoricalSinkFactory;
import org.auramed.streaming.sink.RedisFeastSink;
import org.auramed.streaming.window.AdherenceSlidingWindowProcessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

public class AuraMedStreamingApp {

    private static final Logger LOG = LoggerFactory.getLogger(AuraMedStreamingApp.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        ParameterTool params = ParameterTool.fromArgs(args);

        String kafkaBrokers = params.get("kafka.brokers", "localhost:9092");
        String dispenseTopic = params.get("kafka.topic.dispense", "telemetry.claims.dispense");
        String obsTopic = params.get("kafka.topic.observations", "telemetry.clinical.observations");
        String consumerGroup = params.get("kafka.group.id", "auramed-streaming-group");

        String redisHost = params.get("redis.host", "localhost");
        int redisPort = params.getInt("redis.port", 6379);
        String redisPassword = params.get("redis.password", "");
        String s3BasePath = params.get("s3.sink.path", "s3a://auramed-data-lake/features/historical/");

        LOG.info("Configuring AuraMed Streaming Execution Engine...");

        Configuration flinkConfig = new Configuration();
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment(flinkConfig);

        // Production Checkpointing
        env.enableCheckpointing(60000, CheckpointingMode.EXACTLY_ONCE);
        CheckpointConfig checkpointConfig = env.getCheckpointConfig();
        checkpointConfig.setMinPauseBetweenCheckpoints(30000);
        checkpointConfig.setCheckpointTimeout(120000);
        checkpointConfig.setTolerableCheckpointFailureNumber(3);
        checkpointConfig.setMaxConcurrentCheckpoints(1);

        // 1. Kafka Source for Claims / Medication Dispenses
        KafkaSource<String> dispenseSource = KafkaSource.<String>builder()
                .setBootstrapServers(kafkaBrokers)
                .setTopics(dispenseTopic)
                .setGroupId(consumerGroup)
                .setStartingOffsets(OffsetsInitializer.earliest())
                .setValueOnlyDeserializer(new SimpleStringSchema())
                .build();

        // 2. Kafka Source for Clinical Observations (Biomarkers)
        KafkaSource<String> obsSource = KafkaSource.<String>builder()
                .setBootstrapServers(kafkaBrokers)
                .setTopics(obsTopic)
                .setGroupId(consumerGroup)
                .setStartingOffsets(OffsetsInitializer.earliest())
                .setValueOnlyDeserializer(new SimpleStringSchema())
                .build();

        WatermarkStrategy<AuraMedEvent> watermarkStrategy = WatermarkStrategy
                .<AuraMedEvent>forBoundedOutOfOrderness(Duration.ofHours(24))
                .withTimestampAssigner(new SerializableTimestampAssigner<AuraMedEvent>() {
                    @Override
                    public long extractTimestamp(AuraMedEvent element, long recordTimestamp) {
                        return element.getEventTimestamp();
                    }
                });

        // Parse dispense stream
        DataStream<AuraMedEvent> dispenseStream = env.fromSource(dispenseSource, WatermarkStrategy.noWatermarks(), "KafkaDispenseSource")
                .flatMap((String json, org.apache.flink.util.Collector<AuraMedEvent> out) -> {
                    try {
                        DispenseRecord d = MAPPER.readValue(json, DispenseRecord.class);
                        if (d.getPatientToken() != null && !d.getPatientToken().isEmpty()) {
                            out.collect(AuraMedEvent.fromDispense(d));
                        }
                    } catch (Exception e) {
                        LOG.warn("Failed to deserialize Dispense record: {}", json, e);
                    }
                })
                .returns(AuraMedEvent.class);

        // Parse observation stream
        DataStream<AuraMedEvent> obsStream = env.fromSource(obsSource, WatermarkStrategy.noWatermarks(), "KafkaObservationSource")
                .flatMap((String json, org.apache.flink.util.Collector<AuraMedEvent> out) -> {
                    try {
                        ObservationRecord obs = MAPPER.readValue(json, ObservationRecord.class);
                        if (obs.getPatientToken() != null && !obs.getPatientToken().isEmpty()) {
                            out.collect(AuraMedEvent.fromObservation(obs));
                        }
                    } catch (Exception e) {
                        LOG.warn("Failed to deserialize Observation record: {}", json, e);
                    }
                })
                .returns(AuraMedEvent.class);

        // Union streams, apply watermarking, and key by patient token
        DataStream<AuraMedEvent> unifiedStream = dispenseStream
                .union(obsStream)
                .assignTimestampsAndWatermarks(watermarkStrategy);

        // Apply 90-day sliding window with 1-day slide
        DataStream<PatientFeatureVector> featureVectors = unifiedStream
                .keyBy(AuraMedEvent::getPatientToken)
                .window(SlidingEventTimeWindows.of(Time.days(90), Time.days(1)))
                .process(new AdherenceSlidingWindowProcessor())
                .name("Adherence90dSlidingWindow");

        // Sink 1: Low-latency Feast Online Store in Redis
        featureVectors.addSink(new RedisFeastSink(redisHost, redisPort, redisPassword, 0, "auramed:patient:"))
                .name("RedisFeastOnlineSink");

        // Sink 2: Historical Parquet / JSON Cold Storage (Iceberg / S3)
        if (s3BasePath != null && !s3BasePath.isEmpty()) {
            featureVectors
                    .map(IcebergHistoricalSinkFactory::serializeToJson)
                    .name("JsonSerializeForHistorical")
                    .sinkTo(IcebergHistoricalSinkFactory.createS3HistoricalSink(s3BasePath))
                    .name("IcebergS3HistoricalSink");
        }

        LOG.info("Submitting AuraMed Real-Time Adherence Streaming Topology to cluster...");
        env.execute("AuraMed-Adherence-Streaming-Pipeline");
    }
}
