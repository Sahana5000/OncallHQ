# OnCallHQ: Schedule & Escalation Semantics Specification

## 1. Overview
This document specifies the formal semantics for on-call schedule resolution, layer composition, user overrides, escalation policy timeouts, alert deduplication, and incident state transitions in OnCallHQ.

---

## 2. On-Call Schedule Resolution

### 2.1 Schedule Layers & Overrides
An on-call schedule consists of:
1. **Base Rotation Layers (Priority Order 1..N)**: Standard repeating rotations (Daily, Weekly, Custom).
2. **User Overrides**: Time-bounded explicit shifts that supersede base rotation layers.

### 2.2 Resolution Algorithm
For a given `service_id` and timestamp `T` (in UTC):
1. Check for active **Overrides** where `T` falls within `overrides.time_range`.
   - If an active override exists, return the assigned `user_id`.
2. If no override exists, evaluate **Schedule Layers** in ascending order of layer priority (`layer_index`).
   - Find the layer where `T` falls within `schedule_layers.time_range` or matches the rotation shift recurrence.
   - Return the active user for that layer shift.
3. If no active responder is found across all layers and overrides, escalate to the **Service Fallback Owner** / Org Admin.

### 2.3 PostgreSQL Range Model
- Schedule shifts and overrides are modeled using PostgreSQL `tstzrange` (Timestamp with Time Zone Range).
- Exclusion constraints on `(schedule_id, time_range)` enforce no overlapping shifts within a single layer.

---

## 3. Incident Lifecycle & Escalation Semantics

### 3.1 Incident State Machine
An incident moves through the following deterministic states:

```
[ALERT INGESTED] ──(New fingerprint)──► TRIGGERED
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │ (Ack timeout / No response)               │ (Responder Ack)
                       ▼                                           ▼
                 ESCALATED (Tier N+1)                         ACKNOWLEDGED
                       │                                           │
                       │ (Final Tier timeout)                      │ (Responder Resolve)
                       ▼                                           ▼
                 UNACKNOWLEDGED / EXHAUSTED                      RESOLVED
```

- **TRIGGERED**: Incident created, notification dispatched to Tier 1 on-call responder.
- **ACKNOWLEDGED**: Responder claimed ownership. Escalation timers immediately cancelled.
- **RESOLVED**: Problem fixed; timeline finalized.
- **ESCALATED**: Timer expired without acknowledgment; moved to next responder tier in escalation policy.

### 3.2 Escalation Timers & Cancellation
- When an incident transitions to `TRIGGERED` or `ESCALATED`:
  1. Calculate `next_escalation_at = current_time + tier_timeout_minutes`.
  2. Enqueue a delayed job in Redis via BullMQ with `delay = tier_timeout_minutes * 60 * 1000`.
  3. Store `job_id` on the incident record.
- When an incident transitions to `ACKNOWLEDGED` or `RESOLVED`:
  1. Retrieve `job_id` from the incident record.
  2. Remove the delayed job from BullMQ queue to cancel escalation.

---

## 4. Alert Ingestion & Deduplication

### 4.1 Fingerprinting
- Alerts are grouped by `fingerprint = SHA256(service_id + alert_name + target_resource)`.
- If an existing incident with the same `fingerprint` is in state `TRIGGERED` or `ACKNOWLEDGED`:
  - Do **not** create a new incident.
  - Append the raw alert payload to the incident's timeline log.
  - Increment the alert count on the existing incident.
- If no open incident exists for that fingerprint, create a new `TRIGGERED` incident.

---

## 5. Audit Logging
Every state change (Ingested, Triggered, Escalated, Acked, Resolved, Override Created) MUST produce an immutable `audit_log` entry with:
- `actor_id` (User ID, System, or Service Key)
- `action` (e.g. `INCIDENT_ACKNOWLEDGED`, `SCHEDULE_OVERRIDE_CREATED`)
- `entity_type` & `entity_id`
- `metadata` (JSON payload of snapshot changes)
- `created_at` (UTC timestamp)
