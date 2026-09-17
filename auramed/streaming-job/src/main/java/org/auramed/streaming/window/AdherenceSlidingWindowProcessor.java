package org.auramed.streaming.window;

import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;
import org.auramed.streaming.model.AuraMedEvent;
import org.auramed.streaming.model.DispenseRecord;
import org.auramed.streaming.model.ObservationRecord;
import org.auramed.streaming.model.PatientFeatureVector;

import java.util.*;

/**
 * Stateful sliding window processor evaluating adherence uncertainty and biomarker trajectories.
 * Window specification: 90-day window duration, 1-day slide.
 */
public class AdherenceSlidingWindowProcessor
        extends ProcessWindowFunction<AuraMedEvent, PatientFeatureVector, String, TimeWindow> {

    private static final long serialVersionUID = 1L;
    private static final long MS_PER_DAY = 86_400_000L;
    private static final int WINDOW_DAYS = 90;

    // Standard clinical LOINC codes
    public static final String LOINC_SBP = "8480-6";
    public static final String LOINC_HBA1C = "4548-4";

    @Override
    public void process(String patientToken,
                        Context context,
                        Iterable<AuraMedEvent> elements,
                        Collector<PatientFeatureVector> out) {

        TimeWindow window = context.window();
        long windowStart = window.getStart();
        long windowEnd = window.getEnd();

        List<DispenseRecord> dispenses = new ArrayList<>();
        List<ObservationRecord> observations = new ArrayList<>();

        for (AuraMedEvent event : elements) {
            if (event.getEventType() == AuraMedEvent.EventType.DISPENSE && event.getDispense() != null) {
                dispenses.add(event.getDispense());
            } else if (event.getEventType() == AuraMedEvent.EventType.OBSERVATION && event.getObservation() != null) {
                observations.add(event.getObservation());
            }
        }

        // Sort chronologically
        dispenses.sort(Comparator.comparingLong(DispenseRecord::getFillEpochMillis));
        observations.sort(Comparator.comparingLong(ObservationRecord::getEffectiveEpochMillis));

        // 1. Compute Proportion of Days Covered (PDC) as 90-bit day-level Bitmask
        BitSet pdcBitmask = computePdcBitmask(dispenses, windowStart, windowEnd);
        int coveredDays = pdcBitmask.cardinality();
        double pdc = (double) coveredDays / WINDOW_DAYS;
        String bitmaskHex = toHexString(pdcBitmask, WINDOW_DAYS);

        // 2. Compute Refill Gap Index (RGI) and Pickup Interval Variance
        double rgi = computeRefillGapIndex(dispenses, windowStart, windowEnd);
        double pickupVariance = computePickupIntervalVariance(dispenses);

        // 3. Compute Biomarker Trajectory Slopes (OLS over last 3 measurements)
        Double sbpSlope = computeBiomarkerSlope(observations, LOINC_SBP, 3);
        Double hba1cSlope = computeBiomarkerSlope(observations, LOINC_HBA1C, 3);

        Double lastSbp = getLastObservationValue(observations, LOINC_SBP);
        Double lastHba1c = getLastObservationValue(observations, LOINC_HBA1C);

        // Assemble Feature Vector
        PatientFeatureVector vector = new PatientFeatureVector();
        vector.setPatientToken(patientToken);
        vector.setWindowStartMs(windowStart);
        vector.setWindowEndMs(windowEnd);
        vector.setPdc90d(Math.min(1.0, Math.max(0.0, pdc)));
        vector.setPdcBitmaskHex(bitmaskHex);
        vector.setCoveredDaysCount(coveredDays);
        vector.setRefillGapIndex(rgi);
        vector.setPickupIntervalVariance(pickupVariance);
        vector.setSbpSlopePerDay(sbpSlope);
        vector.setHba1cSlopePerDay(hba1cSlope);
        vector.setLastSbpValue(lastSbp);
        vector.setLastHba1cValue(lastHba1c);
        vector.setDispenseCount(dispenses.size());
        vector.setObservationCount(observations.size());
        vector.setCalculatedAt(System.currentTimeMillis());

        out.collect(vector);
    }

    /**
     * Projects medication supply intervals onto a 90-day bitmask.
     * Incorporates CMS push-forward logic for early refills (preventing double counting).
     */
    public static BitSet computePdcBitmask(List<DispenseRecord> dispenses, long windowStart, long windowEnd) {
        BitSet bitSet = new BitSet(WINDOW_DAYS);
        if (dispenses.isEmpty()) {
            return bitSet;
        }

        long currentCoverageEnd = -1;

        for (DispenseRecord d : dispenses) {
            long fillTime = d.getFillEpochMillis();
            int supply = d.getDaysSupply();
            if (supply <= 0) continue;

            // If fill happens while previous supply still active, push start date forward
            long effectiveStart = Math.max(fillTime, currentCoverageEnd);
            long effectiveEnd = effectiveStart + (supply * MS_PER_DAY);
            currentCoverageEnd = effectiveEnd;

            // Map [effectiveStart, effectiveEnd) to window day indices [0..89]
            int startDay = (int) ((effectiveStart - windowStart) / MS_PER_DAY);
            int endDay = (int) Math.ceil((double) (effectiveEnd - windowStart) / MS_PER_DAY);

            int clampedStart = Math.max(0, startDay);
            int clampedEnd = Math.min(WINDOW_DAYS, endDay);

            for (int day = clampedStart; day < clampedEnd; day++) {
                bitSet.set(day, true);
            }
        }

        return bitSet;
    }

    /**
     * Encodes 90-bit BitSet as a fixed-length Hexadecimal string (24 hex characters).
     */
    public static String toHexString(BitSet bitSet, int numBits) {
        int byteCount = (numBits + 7) / 8;
        byte[] bytes = new byte[byteCount];
        for (int i = 0; i < numBits; i++) {
            if (bitSet.get(i)) {
                bytes[i / 8] |= (1 << (i % 8));
            }
        }
        StringBuilder sb = new StringBuilder(byteCount * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /**
     * Refill Gap Index: Cumulative days without medication supply divided by total eligible observation days.
     */
    public static double computeRefillGapIndex(List<DispenseRecord> dispenses, long windowStart, long windowEnd) {
        if (dispenses.isEmpty()) {
            return 1.0; // Complete adherence gap
        }

        long totalGapMs = 0;
        long coverageEnd = -1;

        for (DispenseRecord d : dispenses) {
            long fillTime = d.getFillEpochMillis();
            int supply = d.getDaysSupply();

            if (coverageEnd > 0 && fillTime > coverageEnd) {
                // Gap identified between supply exhaustion and subsequent refill
                totalGapMs += (fillTime - coverageEnd);
            }

            long thisEnd = Math.max(fillTime, coverageEnd) + (supply * MS_PER_DAY);
            coverageEnd = thisEnd;
        }

        // Add tail gap if coverage ended before windowEnd
        if (coverageEnd > 0 && coverageEnd < windowEnd) {
            totalGapMs += (windowEnd - coverageEnd);
        }

        long totalWindowMs = windowEnd - windowStart;
        double rgi = (double) totalGapMs / totalWindowMs;
        return Math.min(1.0, Math.max(0.0, rgi));
    }

    /**
     * Calculates the sample variance of pickup intervals (days between successive fills).
     */
    public static double computePickupIntervalVariance(List<DispenseRecord> dispenses) {
        if (dispenses.size() < 3) {
            return 0.0;
        }

        List<Double> intervals = new ArrayList<>();
        for (int i = 0; i < dispenses.size() - 1; i++) {
            long t1 = dispenses.get(i).getFillEpochMillis();
            long t2 = dispenses.get(i + 1).getFillEpochMillis();
            double days = (double) (t2 - t1) / MS_PER_DAY;
            intervals.add(days);
        }

        int n = intervals.size();
        if (n < 2) return 0.0;

        double sum = 0.0;
        for (double v : intervals) sum += v;
        double mean = sum / n;

        double sumSquares = 0.0;
        for (double v : intervals) {
            sumSquares += Math.pow(v - mean, 2);
        }

        return sumSquares / (n - 1);
    }

    /**
     * Calculates Ordinary Least Squares (OLS) linear regression slope of biomarker values over the last k measurements.
     * Slope units: delta measurement / day.
     */
    public static Double computeBiomarkerSlope(List<ObservationRecord> observations, String loincCode, int lastK) {
        List<ObservationRecord> filtered = new ArrayList<>();
        for (ObservationRecord obs : observations) {
            if (loincCode.equalsIgnoreCase(obs.getLoincCode())) {
                filtered.add(obs);
            }
        }

        if (filtered.size() < lastK) {
            return null; // Insufficient longitudinal measurements to establish valid trajectory slope
        }

        // Take last k measurements
        int startIndex = filtered.size() - lastK;
        List<ObservationRecord> windowed = filtered.subList(startIndex, filtered.size());

        long t0 = windowed.get(0).getEffectiveEpochMillis();
        double[] x = new double[lastK]; // Time in days from t0
        double[] y = new double[lastK]; // Biomarker value

        double sumX = 0;
        double sumY = 0;

        for (int i = 0; i < lastK; i++) {
            ObservationRecord obs = windowed.get(i);
            x[i] = (double) (obs.getEffectiveEpochMillis() - t0) / MS_PER_DAY;
            y[i] = obs.getMeasurementValue();
            sumX += x[i];
            sumY += y[i];
        }

        double meanX = sumX / lastK;
        double meanY = sumY / lastK;

        double numerator = 0.0;
        double denominator = 0.0;

        for (int i = 0; i < lastK; i++) {
            double dx = x[i] - meanX;
            double dy = y[i] - meanY;
            numerator += dx * dy;
            denominator += dx * dx;
        }

        if (Math.abs(denominator) < 1e-9) {
            return 0.0; // All measurements taken simultaneously
        }

        return numerator / denominator;
    }

    private Double getLastObservationValue(List<ObservationRecord> observations, String loincCode) {
        for (int i = observations.size() - 1; i >= 0; i--) {
            ObservationRecord obs = observations.get(i);
            if (loincCode.equalsIgnoreCase(obs.getLoincCode())) {
                return obs.getMeasurementValue();
            }
        }
        return null;
    }
}
