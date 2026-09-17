package org.auramed.streaming.sink;

import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.sink.RichSinkFunction;
import org.auramed.streaming.model.PatientFeatureVector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;

import java.util.HashMap;
import java.util.Map;

/**
 * Low-latency Redis sink function projecting real-time patient adherence feature vectors
 * into Redis hashes compatible with Feast Online Feature Store.
 */
public class RedisFeastSink extends RichSinkFunction<PatientFeatureVector> {

    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(RedisFeastSink.class);

    private final String redisHost;
    private final int redisPort;
    private final String redisPassword;
    private final int redisDatabase;
    private final String keyPrefix;

    private transient JedisPool jedisPool;

    public RedisFeastSink(String redisHost, int redisPort, String redisPassword, int redisDatabase, String keyPrefix) {
        this.redisHost = redisHost;
        this.redisPort = redisPort;
        this.redisPassword = redisPassword;
        this.redisDatabase = redisDatabase;
        this.keyPrefix = keyPrefix != null ? keyPrefix : "auramed:patient:";
    }

    @Override
    public void open(Configuration parameters) {
        JedisPoolConfig poolConfig = new JedisPoolConfig();
        poolConfig.setMaxTotal(32);
        poolConfig.setMaxIdle(16);
        poolConfig.setMinIdle(4);
        poolConfig.setTestOnBorrow(true);

        if (redisPassword != null && !redisPassword.trim().isEmpty()) {
            this.jedisPool = new JedisPool(poolConfig, redisHost, redisPort, 2000, redisPassword, redisDatabase);
        } else {
            this.jedisPool = new JedisPool(poolConfig, redisHost, redisPort, 2000, null, redisDatabase);
        }
        LOG.info("Initialized Redis Feast connection pool to {}:{}", redisHost, redisPort);
    }

    @Override
    public void invoke(PatientFeatureVector vector, Context context) {
        if (vector == null || vector.getPatientToken() == null) {
            return;
        }

        String redisKey = keyPrefix + vector.getPatientToken();
        Map<String, String> hash = new HashMap<>();

        hash.put("pdc_90d", String.format(java.util.Locale.US, "%.4f", vector.getPdc90d()));
        hash.put("pdc_bitmask_hex", vector.getPdcBitmaskHex() != null ? vector.getPdcBitmaskHex() : "");
        hash.put("covered_days", String.valueOf(vector.getCoveredDaysCount()));
        hash.put("refill_gap_index", String.format(java.util.Locale.US, "%.4f", vector.getRefillGapIndex()));
        hash.put("pickup_interval_variance", String.format(java.util.Locale.US, "%.4f", vector.getPickupIntervalVariance()));

        if (vector.getSbpSlopePerDay() != null) {
            hash.put("sbp_slope_per_day", String.format(java.util.Locale.US, "%.4f", vector.getSbpSlopePerDay()));
        } else {
            hash.put("sbp_slope_per_day", "null");
        }

        if (vector.getHba1cSlopePerDay() != null) {
            hash.put("hba1c_slope_per_day", String.format(java.util.Locale.US, "%.4f", vector.getHba1cSlopePerDay()));
        } else {
            hash.put("hba1c_slope_per_day", "null");
        }

        if (vector.getLastSbpValue() != null) {
            hash.put("last_sbp_value", String.valueOf(vector.getLastSbpValue()));
        }
        if (vector.getLastHba1cValue() != null) {
            hash.put("last_hba1c_value", String.valueOf(vector.getLastHba1cValue()));
        }

        hash.put("dispense_count", String.valueOf(vector.getDispenseCount()));
        hash.put("observation_count", String.valueOf(vector.getObservationCount()));
        hash.put("window_end_ms", String.valueOf(vector.getWindowEndMs()));
        hash.put("updated_at", String.valueOf(System.currentTimeMillis()));

        try (Jedis jedis = jedisPool.getResource()) {
            jedis.hset(redisKey, hash);
            // Feast feature TTL (e.g. 180 days)
            jedis.expire(redisKey, 180 * 86400);
        } catch (Exception e) {
            LOG.error("Failed to write feature vector to Redis for patient {}: {}", vector.getPatientToken(), e.getMessage());
        }
    }

    @Override
    public void close() {
        if (jedisPool != null && !jedisPool.isClosed()) {
            jedisPool.close();
            LOG.info("Closed Redis Feast connection pool");
        }
    }
}
