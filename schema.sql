-- ============================================================
-- AgroMind Regret AI+ — PostgreSQL Schema
-- Run: psql -U agromind_user -d agromind_db -f schema.sql
-- Or use: npm run migrate (from backend/)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    email             VARCHAR(255) UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    phone             VARCHAR(20),
    location          VARCHAR(255),
    latitude          DECIMAL(9,6),
    longitude         DECIMAL(9,6),
    farm_size         DECIMAL(10,2),
    farm_size_unit    VARCHAR(10) DEFAULT 'acres',
    language          VARCHAR(10) DEFAULT 'en',
    profile_image_url TEXT,
    notification_enabled BOOLEAN DEFAULT true,
    push_token        VARCHAR(500),
    is_verified       BOOLEAN DEFAULT false,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Farms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    location    VARCHAR(255),
    latitude    DECIMAL(9,6),
    longitude   DECIMAL(9,6),
    total_area  DECIMAL(10,2),
    area_unit   VARCHAR(10) DEFAULT 'acres',
    soil_type   VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Crops ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crops (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id                UUID REFERENCES farms(id) ON DELETE SET NULL,
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                   VARCHAR(100) NOT NULL,
    variety                VARCHAR(100),
    field_name             VARCHAR(100),
    area                   DECIMAL(10,2),
    area_unit              VARCHAR(10) DEFAULT 'acres',
    planted_date           DATE,
    expected_harvest_date  DATE,
    status                 VARCHAR(50) DEFAULT 'growing',
    health_score           INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scans (AI + ML predictions) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id          UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id          UUID REFERENCES farms(id) ON DELETE SET NULL,
    image_url        TEXT,
    image_filename   VARCHAR(500),
    disease_name     VARCHAR(255),
    plant_name       VARCHAR(255),
    confidence       DECIMAL(5,2),
    severity         VARCHAR(20) CHECK (severity IN ('critical','warning','info','healthy')),
    potential_loss   DECIMAL(12,2) DEFAULT 0,
    currency         VARCHAR(10) DEFAULT 'INR',
    recommendation   TEXT,
    regret_insight   TEXT,
    treatment_steps  JSONB DEFAULT '[]',
    disease_info     JSONB DEFAULT '{}',
    ml_raw_result    JSONB,
    ai_response      JSONB,
    source           VARCHAR(20) DEFAULT 'ai' CHECK (source IN ('ml','ai','combined')),
    status           VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','analyzed','resolved','ignored')),
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Alerts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id             UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id             UUID REFERENCES farms(id) ON DELETE SET NULL,
    scan_id             UUID REFERENCES scans(id) ON DELETE SET NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    severity            VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')),
    type                VARCHAR(50) DEFAULT 'disease' CHECK (type IN ('disease','pest','nutrient','irrigation','weather','system')),
    potential_loss      DECIMAL(12,2) DEFAULT 0,
    preventable_loss    DECIMAL(12,2) DEFAULT 0,
    time_left_seconds   INTEGER,
    confidence          DECIMAL(5,2),
    affected_radius_km  DECIMAL(6,2) DEFAULT 5,
    latitude            DECIMAL(9,6),
    longitude           DECIMAL(9,6),
    is_read             BOOLEAN DEFAULT false,
    is_resolved         BOOLEAN DEFAULT false,
    resolved_at         TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Weather Snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_snapshots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude          DECIMAL(9,6),
    longitude         DECIMAL(9,6),
    city              VARCHAR(255),
    temperature       DECIMAL(6,2),
    humidity          DECIMAL(6,2),
    wind_speed        DECIMAL(6,2),
    rainfall          DECIMAL(8,2),
    rain_probability  DECIMAL(6,2),
    uv_index          DECIMAL(6,2),
    condition         VARCHAR(100),
    description       TEXT,
    icon              VARCHAR(20),
    disease_risk_score DECIMAL(6,2),
    risk_factors      JSONB DEFAULT '[]',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nearby Alerts (cross-user disease spread notifications) ───────────────────
CREATE TABLE IF NOT EXISTS nearby_alerts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id          UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    notified_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    distance_km       DECIMAL(6,2),
    is_read           BOOLEAN DEFAULT false,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alert_id, notified_user_id)
);

-- ── Loss Prevention Records ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loss_prevention_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id          UUID REFERENCES alerts(id) ON DELETE SET NULL,
    scan_id           UUID REFERENCES scans(id) ON DELETE SET NULL,
    crop_id           UUID REFERENCES crops(id) ON DELETE SET NULL,
    amount_prevented  DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency          VARCHAR(10) DEFAULT 'INR',
    action_taken      TEXT,
    recorded_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Community Posts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    crop_name       VARCHAR(100),
    location        VARCHAR(255),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    action_taken    TEXT,
    result          TEXT,
    savings         DECIMAL(12,2),
    image_url       TEXT,
    likes_count     INTEGER DEFAULT 0,
    comments_count  INTEGER DEFAULT 0,
    is_verified     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Post Likes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- ── Post Comments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Analytics Snapshots (daily aggregates) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date           DATE NOT NULL,
    total_alerts            INTEGER DEFAULT 0,
    resolved_alerts         INTEGER DEFAULT 0,
    loss_prevented          DECIMAL(12,2) DEFAULT 0,
    potential_loss          DECIMAL(12,2) DEFAULT 0,
    scans_count             INTEGER DEFAULT 0,
    avg_response_time_hours DECIMAL(6,2),
    crop_health_avg         DECIMAL(5,2),
    UNIQUE(user_id, snapshot_date)
);

-- ── Predictions (generic prediction records) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id          UUID REFERENCES crops(id) ON DELETE SET NULL,
    prediction_type  VARCHAR(100) NOT NULL,
    input_payload    JSONB DEFAULT '{}',
    output_payload   JSONB DEFAULT '{}',
    confidence       DECIMAL(5,2),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tasks (action tracking) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_ref  VARCHAR(120) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    status        VARCHAR(50) DEFAULT 'pending',
    note          TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, external_ref)
);

-- ── Chat History (conversation persistence) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_message        TEXT NOT NULL,
    assistant_reply     TEXT NOT NULL,
    language            VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en','hi','mr')),
    context_snapshot    JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Schemes (optional persisted catalog) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS schemes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(120) UNIQUE,
    title       VARCHAR(255) NOT NULL,
    category    VARCHAR(100),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notification Preferences ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    critical_alerts       BOOLEAN DEFAULT true,
    warning_alerts        BOOLEAN DEFAULT true,
    info_alerts           BOOLEAN DEFAULT false,
    email_notifications   BOOLEAN DEFAULT true,
    sms_notifications     BOOLEAN DEFAULT false,
    push_notifications    BOOLEAN DEFAULT true,
    nearby_farmer_alerts  BOOLEAN DEFAULT true,
    weekly_report         BOOLEAN DEFAULT true,
    community_updates     BOOLEAN DEFAULT false,
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notification Logs (audit trail of sent messages) ──────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id        UUID REFERENCES alerts(id) ON DELETE SET NULL,
    type            VARCHAR(50) NOT NULL CHECK (type IN ('sms','email','push')),
    channel          VARCHAR(100),
    subject         VARCHAR(255),
    message         TEXT,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','bounced')),
    error_message   TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Performance Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scans_user_id        ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at     ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status         ON scans(status);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id       ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity      ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved   ON alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at    ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_location      ON alerts(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_crops_user_id        ON crops(user_id);
CREATE INDEX IF NOT EXISTS idx_crops_farm_id        ON crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_at   ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loss_records_user    ON loss_prevention_records(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_date  ON analytics_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_nearby_alerts_user   ON nearby_alerts(notified_user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_id  ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id        ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_schemes_category     ON schemes(category);
CREATE INDEX IF NOT EXISTS idx_chat_history_user    ON chat_history(user_id, created_at DESC);

-- ── Auto updated_at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_farms_updated_at          BEFORE UPDATE ON farms          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_crops_updated_at          BEFORE UPDATE ON crops          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_scans_updated_at          BEFORE UPDATE ON scans          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_alerts_updated_at         BEFORE UPDATE ON alerts         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tasks_updated_at          BEFORE UPDATE ON tasks          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_schemes_updated_at        BEFORE UPDATE ON schemes        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes for notification_logs ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_user_id ON weather_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_created_at ON weather_snapshots(created_at DESC);

-- ── OTP Authentication Extension ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS village VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_blocked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create unique index on phone for OTP authentication
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

