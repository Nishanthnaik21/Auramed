package org.auramed.streaming;

import org.auramed.streaming.model.DispenseRecord;
import org.auramed.streaming.model.ObservationRecord;
import org.auramed.streaming.window.AdherenceSlidingWindowProcessor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class AdherenceAlgorithmsTest {

    private static final long MS_PER_DAY = 86_400_000L;
    private static final long BASE_TIME = Instant.parse("2026-01-01T00:00:00Z").toEpochMilli();
    private static final long WINDOW_START = BASE_TIME;
    private static final long WINDOW_END = BASE_TIME + (90L * MS_PER_DAY);

    @Test
    @DisplayName("PDC Bitmask: Full 90-day coverage yields PDC=1.0 and 90 bits set")
    void testPerfectAdherencePdc() {
        List<DispenseRecord> dispenses = new ArrayList<>();
        // 3 consecutive 30-day dispenses at day 0, 30, and 60
        dispenses.add(createDispense("d1", BASE_TIME, 30));
        dispenses.add(createDispense("d2", BASE_TIME + (30L * MS_PER_DAY), 30));
        dispenses.add(createDispense("d3", BASE_TIME + (60L * MS_PER_DAY), 30));

        BitSet bitmask = AdherenceSlidingWindowProcessor.computePdcBitmask(dispenses, WINDOW_START, WINDOW_END);

        assertEquals(90, bitmask.cardinality(), "All 90 days in window must be covered");
        double pdc = (double) bitmask.cardinality() / 90.0;
        assertEquals(1.0, pdc, 1e-6);

        String hex = AdherenceSlidingWindowProcessor.toHexString(bitmask, 90);
        assertNotNull(hex);
        assertFalse(hex.isEmpty());
    }

    @Test
    @DisplayName("PDC Bitmask: Gapped refill correctly sets bitmask and computes PDC")
    void testGappedRefillPdc() {
        List<DispenseRecord> dispenses = new ArrayList<>();
        // Fill 30 days at Day 0 (days 0..29 covered)
        dispenses.add(createDispense("d1", BASE_TIME, 30));
        // Gap of 30 days (days 30..59 empty)
        // Fill 30 days at Day 60 (days 60..89 covered)
        dispenses.add(createDispense("d2", BASE_TIME + (60L * MS_PER_DAY), 30));

        BitSet bitmask = AdherenceSlidingWindowProcessor.computePdcBitmask(dispenses, WINDOW_START, WINDOW_END);

        assertEquals(60, bitmask.cardinality(), "Exactly 60 days must be covered");
        assertTrue(bitmask.get(0));
        assertTrue(bitmask.get(29));
        assertFalse(bitmask.get(30), "Day 30 must be gapped");
        assertFalse(bitmask.get(59), "Day 59 must be gapped");
        assertTrue(bitmask.get(60), "Day 60 must be covered");
        assertTrue(bitmask.get(89), "Day 89 must be covered");

        double pdc = (double) bitmask.cardinality() / 90.0;
        assertEquals(60.0 / 90.0, pdc, 1e-4);
    }

    @Test
    @DisplayName("PDC Bitmask: Early refill pushes start forward to preserve full 60 days coverage")
    void testEarlyRefillPushForward() {
        List<DispenseRecord> dispenses = new ArrayList<>();
        // 30 days at Day 0
        dispenses.add(createDispense("d1", BASE_TIME, 30));
        // Early refill at Day 20 (patient refilled 10 days early) with 30 days supply
        dispenses.add(createDispense("d2", BASE_TIME + (20L * MS_PER_DAY), 30));

        BitSet bitmask = AdherenceSlidingWindowProcessor.computePdcBitmask(dispenses, WINDOW_START, WINDOW_END);

        // With push forward, coverage extends from Day 0 through Day 59 (60 continuous days)
        assertEquals(60, bitmask.cardinality());
        for (int i = 0; i < 60; i++) {
            assertTrue(bitmask.get(i), "Day " + i + " must be covered");
        }
        assertFalse(bitmask.get(60), "Day 60 should not be covered");
    }

    @Test
    @DisplayName("RGI and Interval Variance: Regular vs irregular refill patterns")
    void testRefillGapIndexAndVariance() {
        List<DispenseRecord> regularDispenses = new ArrayList<>();
        regularDispenses.add(createDispense("d1", BASE_TIME, 30));
        regularDispenses.add(createDispense("d2", BASE_TIME + (30L * MS_PER_DAY), 30));
        regularDispenses.add(createDispense("d3", BASE_TIME + (60L * MS_PER_DAY), 30));

        double rgi = AdherenceSlidingWindowProcessor.computeRefillGapIndex(regularDispenses, WINDOW_START, WINDOW_END);
        assertEquals(0.0, rgi, 1e-6, "Regular consecutive refills have zero gap index");

        double variance = AdherenceSlidingWindowProcessor.computePickupIntervalVariance(regularDispenses);
        assertEquals(0.0, variance, 1e-6, "Constant 30-day interval has zero variance");

        List<DispenseRecord> irregularDispenses = new ArrayList<>();
        irregularDispenses.add(createDispense("d1", BASE_TIME, 30));
        irregularDispenses.add(createDispense("d2", BASE_TIME + (20L * MS_PER_DAY), 30)); // 20 days
        irregularDispenses.add(createDispense("d3", BASE_TIME + (65L * MS_PER_DAY), 30)); // 45 days

        double irregularVariance = AdherenceSlidingWindowProcessor.computePickupIntervalVariance(irregularDispenses);
        assertTrue(irregularVariance > 0.0, "Irregular refills must produce positive variance");
    }

    @Test
    @DisplayName("Biomarker Trajectory: OLS slope correctly computes rate of change per day")
    void testBiomarkerTrajectorySlope() {
        List<ObservationRecord> observations = new ArrayList<>();

        // SBP measurements: Day 0 = 140, Day 30 = 130, Day 60 = 120
        // Expected slope = (120 - 140) / 60 = -0.3333 mmHg/day
        observations.add(createObservation("obs1", AdherenceSlidingWindowProcessor.LOINC_SBP, 140.0, BASE_TIME));
        observations.add(createObservation("obs2", AdherenceSlidingWindowProcessor.LOINC_SBP, 130.0, BASE_TIME + (30L * MS_PER_DAY)));
        observations.add(createObservation("obs3", AdherenceSlidingWindowProcessor.LOINC_SBP, 120.0, BASE_TIME + (60L * MS_PER_DAY)));

        Double slope = AdherenceSlidingWindowProcessor.computeBiomarkerSlope(
                observations, AdherenceSlidingWindowProcessor.LOINC_SBP, 3
        );

        assertNotNull(slope);
        assertEquals(-0.3333, slope, 1e-3, "Slope should reflect -0.333 mmHg reduction per day");

        // When fewer than 3 measurements exist, slope must be null
        List<ObservationRecord> insufficient = observations.subList(0, 2);
        Double nullSlope = AdherenceSlidingWindowProcessor.computeBiomarkerSlope(
                insufficient, AdherenceSlidingWindowProcessor.LOINC_SBP, 3
        );
        assertNull(nullSlope, "Fewer than 3 measurements must return null slope");
    }

    private DispenseRecord createDispense(String id, long epochMillis, int daysSupply) {
        DispenseRecord d = new DispenseRecord();
        d.setEventId(id);
        d.setPatientToken("test-patient-token-123");
        d.setFillDate(Instant.ofEpochMilli(epochMillis).toString());
        d.setDaysSupply(daysSupply);
        d.setQuantity(daysSupply);
        return d;
    }

    private ObservationRecord createObservation(String id, String loinc, double val, long epochMillis) {
        ObservationRecord obs = new ObservationRecord();
        obs.setEventId(id);
        obs.setPatientToken("test-patient-token-123");
        obs.setLoincCode(loinc);
        obs.setMeasurementValue(val);
        obs.setEffectiveTime(Instant.ofEpochMilli(epochMillis).toString());
        return obs;
    }
}
