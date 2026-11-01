-- OnCallHQ Migration 002: Authentication, Password Hashing, and Maintenance Windows

-- 1. Add password_hash column to users table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT '$2a$10$7EqJtq98hPqEX7fNZaFWoO.82eG9oO9O7oFqEX7fNZaFWoO82eG9o' NOT NULL;
    END IF;
END $$;

-- 2. Create Maintenance Windows Table for Alert Suppression
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast interval containment checks during alert ingestion
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_service_time 
ON maintenance_windows(service_id, start_time, end_time);
