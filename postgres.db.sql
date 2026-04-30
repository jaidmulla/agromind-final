-- ============================================================
-- AgroMind Regret AI+ — PostgreSQL Complete Database Setup
-- Created: 2026-04-30
-- Database: agromind_db
-- User: agromind_user
-- ============================================================
-- 
-- USAGE:
--   psql -U postgres -c "CREATE DATABASE agromind_db;"
--   psql -U postgres -c "CREATE USER agromind_user WITH PASSWORD 'password123';"
--   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE agromind_db TO agromind_user;"
--   psql -U agromind_user -d agromind_db -f postgres.db.sql
--
-- Or use Docker:
--   docker exec -i agromind-db psql -U agromind_user -d agromind_db < postgres.db.sql
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users Table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    location            VARCHAR(255),
    latitude            DECIMAL(9,6),
    longitude           DECIMAL(9,6),
    farm_size           DECIMAL(10,2),
    farm_size_unit      VARCHAR(10) DEFAULT 'acres',
    language            VARCHAR(10) DEFAULT 'en',
    profile_image_url   TEXT,
    notification_enabled BOOLEAN DEFAULT true,
    push_token          VARCHAR(500),
    is_verified         BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- ── Farms Table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    location            VARCHAR(255),
    latitude            DECIMAL(9,6),
    longitude           DECIMAL(9,6),
    total_area          DECIMAL(10,2),
    area_unit           VARCHAR(10) DEFAULT 'acres',
    soil_type           VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_location ON farms(location);

-- ── Crops Table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crops (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id             UUID REFERENCES farms(id) ON DELETE SET NULL,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    variety             VARCHAR(100),
    planting_date       DATE,
    expected_harvest    DATE,
    area_planted        DECIMAL(10,2),
    area_unit           VARCHAR(10) DEFAULT 'acres',
    crop_stage          VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_user_id ON crops(user_id);
CREATE INDEX IF NOT EXISTS idx_crops_farm_id ON crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_crops_status ON crops(status);

-- ── Scans Table (Disease Detection) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id             UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id             UUID REFERENCES farms(id) ON DELETE SET NULL,
    image_url           VARCHAR(500),
    image_filename      VARCHAR(255),
    disease_name        VARCHAR(255),
    plant_name          VARCHAR(100),
    confidence          DECIMAL(5,2),
    severity            VARCHAR(50),
    potential_loss      DECIMAL(12,2),
    currency            VARCHAR(10) DEFAULT 'INR',
    recommendation      TEXT,
    regret_insight      TEXT,
    treatment_steps     JSONB,
    disease_info        JSONB,
    ml_raw_result       JSONB,
    ai_response         JSONB,
    source              VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'analyzed',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_crop_id ON scans(crop_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_disease ON scans(disease_name);

-- ── Alerts Table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id             UUID REFERENCES crops(id) ON DELETE SET NULL,
    alert_type          VARCHAR(50),
    title               VARCHAR(255),
    message             TEXT,
    severity            VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'active',
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- ── Notifications Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR(50),
    recipient           VARCHAR(255),
    content             TEXT,
    status              VARCHAR(50) DEFAULT 'pending',
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- ── AI Doctor Tasks Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_doctor_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id             UUID REFERENCES scans(id) ON DELETE CASCADE,
    day                 INTEGER,
    title               VARCHAR(255),
    description         TEXT,
    product_name        VARCHAR(255),
    quantity            VARCHAR(100),
    cost_inr            DECIMAL(10,2),
    priority            VARCHAR(50),
    urgency_level       VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'pending',
    disease_name        VARCHAR(255),
    disease_severity    VARCHAR(50),
    weather_context     VARCHAR(255),
    language            VARCHAR(10) DEFAULT 'en',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_user_scan ON ai_doctor_tasks(user_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_status ON ai_doctor_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_priority ON ai_doctor_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_created_at ON ai_doctor_tasks(created_at DESC);

-- ── AI Doctor Recommendations Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_doctor_recommendations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id             UUID REFERENCES scans(id) ON DELETE CASCADE,
    summary             TEXT,
    crop_name           VARCHAR(100),
    disease_name        VARCHAR(255),
    severity            VARCHAR(50),
    total_cost_inr      DECIMAL(10,2),
    deadline_hours      INTEGER,
    urgency             VARCHAR(50),
    language            VARCHAR(10) DEFAULT 'en',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_doctor_recs_user_created ON ai_doctor_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_recs_scan_id ON ai_doctor_recommendations(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_doctor_recs_created_at ON ai_doctor_recommendations(created_at DESC);

-- ── Analytics Snapshots Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_scans         INTEGER DEFAULT 0,
    scans_today         INTEGER DEFAULT 0,
    diseases_detected   INTEGER DEFAULT 0,
    critical_alerts     INTEGER DEFAULT 0,
    avg_crop_health     DECIMAL(5,2),
    estimated_loss_inr  DECIMAL(12,2),
    top_diseases        JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_snapshots(user_id, created_at DESC);

-- ── Chat History Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          VARCHAR(255),
    message_type        VARCHAR(50),
    message_text        TEXT,
    ai_response         TEXT,
    language            VARCHAR(10) DEFAULT 'en',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_user_session ON chat_history(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_history(created_at DESC);

-- ── Weather Alerts Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location            VARCHAR(255),
    alert_type          VARCHAR(50),
    description         TEXT,
    disease_risk        VARCHAR(50),
    temperature         DECIMAL(5,2),
    humidity            DECIMAL(5,2),
    rainfall            DECIMAL(10,2),
    status              VARCHAR(50) DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_user ON weather_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_location ON weather_alerts(location);

-- ── Community Posts Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(255),
    content             TEXT,
    category            VARCHAR(100),
    image_url           TEXT,
    likes_count         INTEGER DEFAULT 0,
    comments_count      INTEGER DEFAULT 0,
    views_count         INTEGER DEFAULT 0,
    language            VARCHAR(10) DEFAULT 'en',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_created_at ON community_posts(created_at DESC);

-- ── Government Schemes Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_schemes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name         VARCHAR(255) NOT NULL,
    description         TEXT,
    eligibility         TEXT,
    benefits            JSONB,
    state               VARCHAR(100),
    min_age             INTEGER,
    max_age             INTEGER,
    application_url     VARCHAR(500),
    last_updated        TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schemes_state ON gov_schemes(state);

-- ── Trigger: Update Timestamps ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON farms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crops_updated_at BEFORE UPDATE ON crops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_logs_updated_at BEFORE UPDATE ON notification_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_doctor_tasks_updated_at BEFORE UPDATE ON ai_doctor_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_doctor_recommendations_updated_at BEFORE UPDATE ON ai_doctor_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_history_updated_at BEFORE UPDATE ON chat_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weather_alerts_updated_at BEFORE UPDATE ON weather_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Grant Permissions ───────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agromind_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agromind_user;
GRANT USAGE ON SCHEMA public TO agromind_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO agromind_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO agromind_user;

-- ============================================================
-- Database setup complete!
-- Tables created: 15
-- Indexes created: 25+
-- Ready for AgroMind Regret AI+ application
-- ============================================================
