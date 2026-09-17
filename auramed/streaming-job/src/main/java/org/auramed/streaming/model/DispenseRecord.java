package org.auramed.streaming.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class DispenseRecord implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("patient_token")
    private String patientToken;

    @JsonProperty("medication_code")
    private String medicationCode;

    @JsonProperty("medication_display")
    private String medicationDisplay;

    @JsonProperty("fill_date")
    private String fillDate;

    @JsonProperty("days_supply")
    private int daysSupply;

    @JsonProperty("quantity")
    private double quantity;

    @JsonProperty("ingested_at")
    private String ingestedAt;

    public DispenseRecord() {}

    public DispenseRecord(String eventId, String patientToken, String medicationCode,
                          String medicationDisplay, String fillDate, int daysSupply,
                          double quantity, String ingestedAt) {
        this.eventId = eventId;
        this.patientToken = patientToken;
        this.medicationCode = medicationCode;
        this.medicationDisplay = medicationDisplay;
        this.fillDate = fillDate;
        this.daysSupply = daysSupply;
        this.quantity = quantity;
        this.ingestedAt = ingestedAt;
    }

    public long getFillEpochMillis() {
        if (fillDate == null || fillDate.isEmpty()) {
            return System.currentTimeMillis();
        }
        try {
            return Instant.parse(fillDate).toEpochMilli();
        } catch (DateTimeParseException e) {
            try {
                // Fallback for YYYY-MM-DD
                return java.time.LocalDate.parse(fillDate, DateTimeFormatter.ISO_LOCAL_DATE)
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

    public String getMedicationCode() { return medicationCode; }
    public void setMedicationCode(String medicationCode) { this.medicationCode = medicationCode; }

    public String getMedicationDisplay() { return medicationDisplay; }
    public void setMedicationDisplay(String medicationDisplay) { this.medicationDisplay = medicationDisplay; }

    public String getFillDate() { return fillDate; }
    public void setFillDate(String fillDate) { this.fillDate = fillDate; }

    public int getDaysSupply() { return daysSupply; }
    public void setDaysSupply(int daysSupply) { this.daysSupply = daysSupply; }

    public double getQuantity() { return quantity; }
    public void setQuantity(double quantity) { this.quantity = quantity; }

    public String getIngestedAt() { return ingestedAt; }
    public void setIngestedAt(String ingestedAt) { this.ingestedAt = ingestedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        DispenseRecord that = (DispenseRecord) o;
        return Objects.equals(eventId, that.eventId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId);
    }
}
