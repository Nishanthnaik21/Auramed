package org.auramed.streaming.model;

import java.io.Serializable;

public class AuraMedEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    public enum EventType {
        DISPENSE,
        OBSERVATION
    }

    private String patientToken;
    private long eventTimestamp;
    private EventType eventType;
    private DispenseRecord dispense;
    private ObservationRecord observation;

    public AuraMedEvent() {}

    public static AuraMedEvent fromDispense(DispenseRecord dispense) {
        AuraMedEvent event = new AuraMedEvent();
        event.patientToken = dispense.getPatientToken();
        event.eventTimestamp = dispense.getFillEpochMillis();
        event.eventType = EventType.DISPENSE;
        event.dispense = dispense;
        return event;
    }

    public static AuraMedEvent fromObservation(ObservationRecord observation) {
        AuraMedEvent event = new AuraMedEvent();
        event.patientToken = observation.getPatientToken();
        event.eventTimestamp = observation.getEffectiveEpochMillis();
        event.eventType = EventType.OBSERVATION;
        event.observation = observation;
        return event;
    }

    public String getPatientToken() { return patientToken; }
    public void setPatientToken(String patientToken) { this.patientToken = patientToken; }

    public long getEventTimestamp() { return eventTimestamp; }
    public void setEventTimestamp(long eventTimestamp) { this.eventTimestamp = eventTimestamp; }

    public EventType getEventType() { return eventType; }
    public void setEventType(EventType eventType) { this.eventType = eventType; }

    public DispenseRecord getDispense() { return dispense; }
    public void setDispense(DispenseRecord dispense) { this.dispense = dispense; }

    public ObservationRecord getObservation() { return observation; }
    public void setObservation(ObservationRecord observation) { this.observation = observation; }
}
