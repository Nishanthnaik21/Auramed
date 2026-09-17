"""Feast Entity Definitions for Project AuraMed."""

from feast import Entity

# Primary entity: Deterministic salted HMAC-SHA256 pseudonymized patient identifier
patient_token = Entity(
    name="patient_token",
    join_keys=["patient_token"],
    description="Deterministic salted HMAC-SHA256 token uniquely resolving patient entity without cleartext PHI",
)
