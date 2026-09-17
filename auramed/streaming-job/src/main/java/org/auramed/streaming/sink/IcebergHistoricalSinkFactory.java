package org.auramed.streaming.sink;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.SimpleStringEncoder;
import org.apache.flink.configuration.MemorySize;
import org.apache.flink.connector.file.sink.FileSink;
import org.apache.flink.core.fs.Path;
import org.apache.flink.streaming.api.functions.sink.filesystem.OutputFileConfig;
import org.apache.flink.streaming.api.functions.sink.filesystem.bucketassigners.DateTimeBucketAssigner;
import org.apache.flink.streaming.api.functions.sink.filesystem.rollingpolicies.DefaultRollingPolicy;
import org.auramed.streaming.model.PatientFeatureVector;

import java.time.Duration;

/**
 * Factory creating historical cold-store sinks for S3 / MinIO / Iceberg storage.
 * Emits partitioned append-only records with hourly roll-over policies.
 */
public class IcebergHistoricalSinkFactory {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static FileSink<String> createS3HistoricalSink(String s3BasePath) {
        OutputFileConfig config = OutputFileConfig
                .builder()
                .withPartPrefix("auramed-features")
                .withPartSuffix(".json.gz")
                .build();

        return FileSink
                .forRowFormat(new Path(s3BasePath), new SimpleStringEncoder<String>("UTF-8"))
                .withBucketAssigner(new DateTimeBucketAssigner<>("'year='yyyy/'month='MM/'day='dd"))
                .withRollingPolicy(
                        DefaultRollingPolicy.builder()
                                .withRolloverInterval(Duration.ofMinutes(15))
                                .withInactivityInterval(Duration.ofMinutes(5))
                                .withMaxPartSize(MemorySize.ofMebiBytes(128))
                                .build())
                .withOutputFileConfig(config)
                .build();
    }

    public static String serializeToJson(PatientFeatureVector vector) {
        try {
            return OBJECT_MAPPER.writeValueAsString(vector);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize feature vector to JSON for historical sink", e);
        }
    }
}
