-- OnCallHQ Initial PostgreSQL Database Schema
-- Migration 001: Core Tables, Temporal Ranges, and Constraints

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'RESPONDER', -- ADMIN, LEAD, RESPONDER
    phone_number VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Services Table (Services being monitored)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ingestion_key VARCHAR(255) UNIQUE NOT NULL,
    fallback_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schedule Layers Table (Base rotations)
CREATE TABLE IF NOT EXISTS schedule_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layer_priority INT NOT NULL DEFAULT 1,
    time_range TSTZRANGE NOT NULL,
    rotation_type VARCHAR(50) NOT NULL DEFAULT 'WEEKLY', -- DAILY, WEEKLY, CUSTOM
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    EXCLUDE USING gist (schedule_id WITH =, time_range WITH &&)
);

-- Overrides Table (Temporary shift overrides)
CREATE TABLE IF NOT EXISTS overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time_range TSTZRANGE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    EXCLUDE USING gist (schedule_id WITH =, time_range WITH &&)
);

-- Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    fingerprint VARCHAR(255) NOT NULL,
    title VARCHAR(512) NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL DEFAULT 'HIGH', -- CRITICAL, HIGH, MEDIUM, LOW
    state VARCHAR(50) NOT NULL DEFAULT 'TRIGGERED', -- TRIGGERED, ACKNOWLEDGED, ESCALATED, RESOLVED
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_tier INT NOT NULL DEFAULT 1,
    alert_count INT NOT NULL DEFAULT 1,
    escalation_job_id VARCHAR(255),
    acked_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications Log Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- EMAIL, WEBHOOK, SMS_MOCK
    status VARCHAR(50) NOT NULL DEFAULT 'SENT', -- QUEUED, SENT, FAILED
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    actor_id VARCHAR(255) NOT NULL, -- User UUID or 'SYSTEM' or service_key
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_service_state ON incidents(service_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_fingerprint_open ON incidents(service_id, fingerprint) WHERE state IN ('TRIGGERED', 'ACKNOWLEDGED', 'ESCALATED');
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_layers_range ON schedule_layers USING gist (time_range);
CREATE INDEX IF NOT EXISTS idx_overrides_range ON overrides USING gist (time_range);
