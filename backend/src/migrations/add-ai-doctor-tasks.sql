-- ============================================================
-- AI Doctor Task Management System Migration
-- Enhanced tasks table with AI Doctor fields
-- ============================================================

-- Drop old simple tasks table
DROP TABLE IF EXISTS tasks CASCADE;

-- ── AI Doctor Tasks Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_doctor_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id             UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    
    -- Task Details
    day                 INTEGER NOT NULL DEFAULT 1,
    task_title          VARCHAR(255) NOT NULL,
    task_description    TEXT NOT NULL,
    
    -- Product & Cost Information
    product_name        VARCHAR(255),
    quantity            VARCHAR(100),
    unit                VARCHAR(50),
    cost_inr            DECIMAL(10,2) DEFAULT 0,
    
    -- Priority & Urgency
    priority            VARCHAR(50) NOT NULL CHECK (priority IN ('urgent', 'recommended', 'optional')),
    urgency_level       VARCHAR(50) NOT NULL CHECK (urgency_level IN ('high', 'medium', 'low')),
    reason              TEXT,
    
    -- Status & Tracking
    status              VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at        TIMESTAMPTZ,
    
    -- Context Information
    disease_name        VARCHAR(255),
    disease_severity    VARCHAR(20),
    weather_context     JSONB DEFAULT '{}',
    community_context   TEXT,
    
    -- Language Support
    language            VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'hi', 'mr')),
    
    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recommendations Cache Table (for faster API responses) ────────────────
CREATE TABLE IF NOT EXISTS ai_doctor_recommendations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id             UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    
    -- Summary Information
    summary             TEXT NOT NULL,
    crop_name           VARCHAR(255),
    disease_name        VARCHAR(255),
    severity            VARCHAR(20),
    
    -- Recommendation Data
    total_cost_inr      DECIMAL(12,2),
    deadline_hours      INTEGER,
    urgency             VARCHAR(50),
    notes               TEXT,
    
    -- Language
    language            VARCHAR(10) DEFAULT 'en',
    
    -- Timestamps (cache validity)
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- ── Indexes for Performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_user_scan 
    ON ai_doctor_tasks(user_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_status 
    ON ai_doctor_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_priority 
    ON ai_doctor_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_created 
    ON ai_doctor_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_recommendations_scan 
    ON ai_doctor_recommendations(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_recommendations_user 
    ON ai_doctor_recommendations(user_id, created_at DESC);

-- ── Triggers for updated_at ────────────────────────────────────────────────
CREATE TRIGGER update_ai_doctor_tasks_updated_at BEFORE UPDATE ON ai_doctor_tasks 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_doctor_recommendations_updated_at BEFORE UPDATE ON ai_doctor_recommendations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
