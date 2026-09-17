"""Feast FeatureView Definitions for Project AuraMed.

Defines:
- claims_adherence_fv: Proportion of days covered, refill gap index, refill entropy, lapses.
- biomarker_trends_fv: Longitudinal lab biomarker trajectories, rate of change slopes, baseline deltas.
"""

from datetime import timedelta
from feast import (
    Array,
    Field,
    FeatureView,
    FileSource,
    PushMode,
    PushSource,
    ValueType,
)
from feast.types import Array as FeastArray, Float32, Int32, Int64, String

from entities import patient_token

# ---------------------------------------------------------------------------
# Data Sources (Offline Historical Parquet & Real-Time Push Stream)
# ---------------------------------------------------------------------------

# Historical offline batch source from Flink Iceberg/S3 export
claims_adherence_batch_source = FileSource(
    name="claims_adherence_batch_source",
    path="s3a://auramed-data-lake/features/historical/claims_adherence.parquet",
    timestamp_field="calculated_at",
    created_timestamp_column="created_at",
)

# Push source allowing Apache Flink streaming sink to push directly into online Feast store
claims_adherence_push_source = PushSource(
    name="claims_adherence_push_source",
    batch_source=claims_adherence_batch_source,
)

biomarker_trends_batch_source = FileSource(
    name="biomarker_trends_batch_source",
    path="s3a://auramed-data-lake/features/historical/biomarker_trends.parquet",
    timestamp_field="calculated_at",
    created_timestamp_column="created_at",
)

biomarker_trends_push_source = PushSource(
    name="biomarker_trends_push_source",
    batch_source=biomarker_trends_batch_source,
)

# ---------------------------------------------------------------------------
# Feature Views
# ---------------------------------------------------------------------------

claims_adherence_fv = FeatureView(
    name="claims_adherence_fv",
    entities=[patient_token],
    ttl=timedelta(days=180),
    schema=[
        Field(name="pdc_90d", dtype=Float32, description="Real-time Proportion of Days Covered over 90-day window (0.0 to 1.0)"),
        Field(name="pdc_bitmask_hex", dtype=String, description="Day-level 90-bit adherence mask encoded in hexadecimal"),
        Field(name="covered_days_count", dtype=Int32, description="Total unique covered days in window"),
        Field(name="refill_gap_index", dtype=Float32, description="Cumulative unmedicated days divided by total eligible duration"),
        Field(name="pickup_interval_variance", dtype=Float32, description="Sample variance of days between successive prescription pickups"),
        Field(name="days_supply_lapses", dtype=Int32, description="Count of gaps exceeding 15 days between refills"),
        Field(name="refill_entropy", dtype=Float32, description="Shannon entropy of refill spacing distribution indicating regimen volatility"),
        Field(name="dispense_count", dtype=Int32, description="Total number of dispenses evaluated within the window"),
    ],
    online=True,
    source=claims_adherence_push_source,
    tags={"tier": "adherence_analytics", "domain": "pharmacy_claims"},
)

biomarker_trends_fv = FeatureView(
    name="biomarker_trends_fv",
    entities=[patient_token],
    ttl=timedelta(days=180),
    schema=[
        Field(name="last_3_sbp_values", dtype=FeastArray(Float32), description="Array of last 3 Systolic Blood Pressure measurements (mmHg)"),
        Field(name="last_3_hba1c_values", dtype=FeastArray(Float32), description="Array of last 3 Glycated Hemoglobin measurements (%)"),
        Field(name="sbp_rate_of_change_per_day", dtype=Float32, description="OLS linear regression slope for SBP (mmHg/day)"),
        Field(name="hba1c_rate_of_change_per_day", dtype=Float32, description="OLS linear regression slope for HbA1c (%/day)"),
        Field(name="sbp_baseline_delta", dtype=Float32, description="Delta between most recent SBP and initial window baseline (mmHg)"),
        Field(name="hba1c_baseline_delta", dtype=Float32, description="Delta between most recent HbA1c and initial window baseline (%)"),
        Field(name="last_sbp_value", dtype=Float32, description="Most recent SBP value (mmHg)"),
        Field(name="last_hba1c_value", dtype=Float32, description="Most recent HbA1c value (%)"),
        Field(name="observation_count", dtype=Int32, description="Total number of biomarker observations evaluated within the window"),
    ],
    online=True,
    source=biomarker_trends_push_source,
    tags={"tier": "clinical_telemetry", "domain": "lab_biomarkers"},
)
