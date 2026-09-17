package org.auramed.streaming.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class PatientFeatureVector implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("patient_token")
    private String patientToken;

    @JsonProperty("window_start_ms")
    private long windowStartMs;

    @JsonProperty("window_end_ms")
    private long windowEndMs;

    @JsonProperty("pdc_90d")
    private double pdc90d;

    @JsonProperty("pdc_bitmask_hex")
    private String pdcBitmaskHex;

    @JsonProperty("covered_days_count")
    private int coveredDaysCount;

    @JsonProperty("refill_gap_index")
    private double refillGapIndex;

    @JsonProperty("pickup_interval_variance")
    private double pickupIntervalVariance;

    @JsonProperty("sbp_slope_per_day")
    private Double sbpSlopePerDay;

    @JsonProperty("hba1c_slope_per_day")
    private Double hba1cSlopePerDay;

    @JsonProperty("last_sbp_value")
    private Double lastSbpValue;

    @JsonProperty("last_hba1c_value")
    private Double lastHba1cValue;

    @JsonProperty("dispense_count")
    private int dispenseCount;

    @JsonProperty("observation_count")
    private int observationCount;

    @JsonProperty("calculated_at")
    private long calculatedAt;

    public PatientFeatureVector() {}

    // Getters and Setters
    public String getPatientToken() { return patientToken; }
    public void setPatientToken(String patientToken) { this.patientToken = patientToken; }

    public long getWindowStartMs() { return windowStartMs; }
    public void setWindowStartMs(long windowStartMs) { this.windowStartMs = windowStartMs; }

    public long getWindowEndMs() { return windowEndMs; }
    public void setWindowEndMs(long windowEndMs) { this.windowEndMs = windowEndMs; }

    public double getPdc90d() { return pdc90d; }
    public void setPdc90d(double pdc90d) { this.pdc90d = pdc90d; }

    public String getPdcBitmaskHex() { return pdcBitmaskHex; }
    public void setPdcBitmaskHex(String pdcBitmaskHex) { this.pdcBitmaskHex = pdcBitmaskHex; }

    public int getCoveredDaysCount() { return coveredDaysCount; }
    public void setCoveredDaysCount(int coveredDaysCount) { this.coveredDaysCount = coveredDaysCount; }

    public double getRefillGapIndex() { return refillGapIndex; }
    public void setRefillGapIndex(double refillGapIndex) { this.refillGapIndex = refillGapIndex; }

    public double getPickupIntervalVariance() { return pickupIntervalVariance; }
    public void setPickupIntervalVariance(double pickupIntervalVariance) { this.pickupIntervalVariance = pickupIntervalVariance; }

    public Double getSbpSlopePerDay() { return sbpSlopePerDay; }
    public void setSbpSlopePerDay(Double sbpSlopePerDay) { this.sbpSlopePerDay = sbpSlopePerDay; }

    public Double getHba1cSlopePerDay() { return hba1cSlopePerDay; }
    public void setHba1cSlopePerDay(Double hba1cSlopePerDay) { this.hba1cSlopePerDay = hba1cSlopePerDay; }

    public Double getLastSbpValue() { return lastSbpValue; }
    public void setLastSbpValue(Double lastSbpValue) { this.lastSbpValue = lastSbpValue; }

    public Double getLastHba1cValue() { return lastHba1cValue; }
    public void setLastHba1cValue(Double lastHba1cValue) { this.lastHba1cValue = lastHba1cValue; }

    public int getDispenseCount() { return dispenseCount; }
    public void setDispenseCount(int dispenseCount) { this.dispenseCount = dispenseCount; }

    public int getObservationCount() { return observationCount; }
    public void setObservationCount(int observationCount) { this.observationCount = observationCount; }

    public long getCalculatedAt() { return calculatedAt; }
    public void setCalculatedAt(long calculatedAt) { this.calculatedAt = calculatedAt; }

    @Override
    public String toString() {
        return "PatientFeatureVector{" +
                "patientToken='" + patientToken + '\'' +
                ", pdc90d=" + pdc90d +
                ", rgi=" + refillGapIndex +
                ", pickupVar=" + pickupIntervalVariance +
                ", sbpSlope=" + sbpSlopePerDay +
                ", hba1cSlope=" + hba1cSlopePerDay +
                '}';
    }
}
