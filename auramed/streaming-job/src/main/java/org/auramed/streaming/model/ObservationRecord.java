package org.auramed.streaming.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ObservationRecord implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("patient_token")
    private String patientToken;

    @JsonProperty("code_system")
    private String codeSystem;

    @JsonProperty("loinc_code")
    private String loincCode;

    @JsonProperty("code_display")
    private String codeDisplay;

    @JsonProperty("measurement_value")
    private double measurementValue;

    @JsonProperty("measurement_unit")
    private String measurementUnit;

    @JsonProperty("effective_time")
    private String effectiveTime;

    @JsonProperty("ingested_at")
    private String ingestedAt;

    public ObservationRecord() {}

    public ObservationRecord(String eventId, String patientToken, String codeSystem,
                             String loincCode, String codeDisplay, double measurementValue,
                             String measurementUnit, String effectiveTime, String ingestedAt) {
        this.eventId = eventId;
        this.patientToken = patientToken;
        this.codeSystem = codeSystem;
        this.loincCode = loincCode;
        this.codeDisplay = codeDisplay;
        this.measurementValue = measurementValue;
        this.measurementUnit = measurementUnit;
        this.effectiveTime = effectiveTime;
        this.ingestedAt = ingestedAt;
    }

    public long getEffectiveEpochMillis() {
        if (effectiveTime == null || effectiveTime.isEmpty()) {
            return System.currentTimeMillis();
        }
        try {
            return Instant.parse(effectiveTime).toEpochMilli();
        } catch (DateTimeParseException e) {
            try {
                return java.time.LocalDate.parse(effectiveTime)
                        .atStartOfDay(java.time.ZoneOffset.UTC)
                        .toInstant()
                        .toEpochMilli();
            } catch (Exception ex) {
                return System.currentTimeMillis();
            }
        }
    }

    // Getters and Setters
    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getPatientToken() { return patientToken; }
    public void setPatientToken(String patientToken) { this.patientToken = patientToken; }

    public String getCodeSystem() { return codeSystem; }
    public void setCodeSystem(String codeSystem) { this.codeSystem = codeSystem; }

    public String getLoincCode() { return loincCode; }
    public void setLoincCode(String loincCode) { this.loincCode = loincCode; }

    public String getCodeDisplay() { return codeDisplay; }
    public void setCodeDisplay(String codeDisplay) { this.codeDisplay = codeDisplay; }

    public double getMeasurementValue() { return measurementValue; }
    public void setMeasurementValue(double measurementValue) { this.measurementValue = measurementValue; }

    public String getMeasurementUnit() { return measurementUnit; }
    public void setMeasurementUnit(String measurementUnit) { this.measurementUnit = measurementUnit; }

    public String getEffectiveTime() { return effectiveTime; }
    public void setEffectiveTime(String effectiveTime) { this.effectiveTime = effectiveTime; }

    public String getIngestedAt() { return ingestedAt; }
    public void setIngestedAt(String ingestedAt) { this.ingestedAt = ingestedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ObservationRecord that = (ObservationRecord) o;
        return Objects.equals(eventId, that.eventId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId);
    }
}
