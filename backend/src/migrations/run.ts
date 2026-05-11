import { query } from '../utils/database';
import dotenv from 'dotenv';
dotenv.config();

const SQL_STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    farm_size DECIMAL(10,2),
    farm_size_unit VARCHAR(10) DEFAULT 'acres',
    language VARCHAR(10) DEFAULT 'en',
    profile_image_url TEXT,
    notification_enabled BOOLEAN DEFAULT true,
    push_token VARCHAR(500),
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    total_area DECIMAL(10,2),
    area_unit VARCHAR(10) DEFAULT 'acres',
    soil_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    field_name VARCHAR(100),
    area DECIMAL(10,2),
    area_unit VARCHAR(10) DEFAULT 'acres',
    planted_date DATE,
    expected_harvest_date DATE,
    status VARCHAR(50) DEFAULT 'growing',
    health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Contract compatibility columns
  `ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(100)`,
  `ALTER TABLE crops ADD COLUMN IF NOT EXISTS location VARCHAR(255)`,
  `UPDATE crops SET crop_type = COALESCE(crop_type, name) WHERE crop_type IS NULL`,

  `CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    image_url TEXT,
    image_filename VARCHAR(500),
    disease_name VARCHAR(255),
    plant_name VARCHAR(255),
    confidence DECIMAL(5,2),
    severity VARCHAR(20) CHECK (severity IN ('critical','warning','info','healthy')),
    potential_loss DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    recommendation TEXT,
    regret_insight TEXT,
    treatment_steps JSONB DEFAULT '[]',
    disease_info JSONB DEFAULT '{}',
    ml_raw_result JSONB,
    ai_response JSONB,
    source VARCHAR(20) DEFAULT 'ml' CHECK (source IN ('ml','ai','combined')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','analyzed','resolved','ignored')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')),
    type VARCHAR(50) DEFAULT 'disease' CHECK (type IN ('disease','pest','nutrient','irrigation','weather','system')),
    potential_loss DECIMAL(12,2) DEFAULT 0,
    preventable_loss DECIMAL(12,2) DEFAULT 0,
    time_left_seconds INTEGER,
    confidence DECIMAL(5,2),
    affected_radius_km DECIMAL(6,2) DEFAULT 5,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Contract compatibility columns
  `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message TEXT`,
  `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,

  `CREATE TABLE IF NOT EXISTS disease_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    image_path TEXT NOT NULL,
    disease_name VARCHAR(255) NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    treatment TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES disease_reports(id) ON DELETE SET NULL`,

  // Backfill compatibility values for existing databases
  `UPDATE alerts
   SET message = COALESCE(message, description, title),
       is_active = COALESCE(is_active, NOT is_resolved)
   WHERE message IS NULL OR is_active IS NULL`,

  `INSERT INTO disease_reports (user_id, crop_id, scan_id, image_path, disease_name, confidence, treatment, severity, created_at)
   SELECT s.user_id,
          s.crop_id,
          s.id,
          COALESCE(s.image_url, ''),
          COALESCE(s.disease_name, 'Unknown'),
          COALESCE(s.confidence, 0),
          s.recommendation,
          CASE
            WHEN s.severity = 'critical' THEN 'high'
            WHEN s.severity = 'warning' THEN 'medium'
            ELSE 'low'
          END,
          s.created_at
   FROM scans s
   WHERE NOT EXISTS (
     SELECT 1 FROM disease_reports dr
     WHERE dr.scan_id = s.id
   )`,

  `UPDATE alerts a
   SET report_id = dr.id
   FROM disease_reports dr
   WHERE a.scan_id IS NOT NULL
     AND dr.scan_id = a.scan_id
     AND a.report_id IS NULL`,

  // Ensure alert geo columns exist for legacy databases
  `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6)`,
  `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6)`,

  `CREATE TABLE IF NOT EXISTS weather_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    city VARCHAR(255),
    temperature DECIMAL(6,2),
    humidity DECIMAL(6,2),
    wind_speed DECIMAL(6,2),
    rainfall DECIMAL(8,2),
    rain_probability DECIMAL(6,2),
    uv_index DECIMAL(6,2),
    condition VARCHAR(100),
    description TEXT,
    icon VARCHAR(20),
    disease_risk_score DECIMAL(6,2),
    risk_factors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS nearby_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    notified_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    distance_km DECIMAL(6,2),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alert_id, notified_user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS loss_prevention_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    amount_prevented DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    action_taken TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT NOT NULL,
    crop_name VARCHAR(100),
    location VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    action_taken TEXT,
    result TEXT,
    savings DECIMAL(12,2),
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_alerts INTEGER DEFAULT 0,
    resolved_alerts INTEGER DEFAULT 0,
    loss_prevented DECIMAL(12,2) DEFAULT 0,
    potential_loss DECIMAL(12,2) DEFAULT 0,
    scans_count INTEGER DEFAULT 0,
    avg_response_time_hours DECIMAL(6,2),
    crop_health_avg DECIMAL(5,2),
    UNIQUE(user_id, snapshot_date)
  )`,

  `CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    prediction_type VARCHAR(100) NOT NULL,
    input_payload JSONB DEFAULT '{}',
    output_payload JSONB DEFAULT '{}',
    confidence DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_ref VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, external_ref)
  )`,

  `CREATE TABLE IF NOT EXISTS schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(120) UNIQUE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    critical_alerts BOOLEAN DEFAULT true,
    warning_alerts BOOLEAN DEFAULT true,
    info_alerts BOOLEAN DEFAULT false,
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    push_notifications BOOLEAN DEFAULT true,
    nearby_farmer_alerts BOOLEAN DEFAULT true,
    weekly_report BOOLEAN DEFAULT true,
    community_updates BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sms','email','push')),
    channel VARCHAR(100),
    subject VARCHAR(255),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','bounced')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(20) NOT NULL CHECK (source IN ('app','http')),
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    meta JSONB DEFAULT '{}',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method VARCHAR(12),
    path TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    ip VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    assistant_reply TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    context_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS ai_doctor_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    day INTEGER NOT NULL DEFAULT 1,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    product_name VARCHAR(255),
    quantity VARCHAR(100),
    unit VARCHAR(50),
    cost_inr DECIMAL(10,2) DEFAULT 0,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('urgent', 'recommended', 'optional')),
    urgency_level VARCHAR(50) NOT NULL CHECK (urgency_level IN ('high', 'medium', 'low')),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMPTZ,
    disease_name VARCHAR(255),
    disease_severity VARCHAR(20),
    weather_context JSONB DEFAULT '{}',
    community_context TEXT,
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'hi', 'mr')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS ai_doctor_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    crop_name VARCHAR(255),
    disease_name VARCHAR(255),
    severity VARCHAR(20),
    total_cost_inr DECIMAL(12,2),
    deadline_hours INTEGER,
    urgency VARCHAR(50),
    notes TEXT,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(user_id, scan_id)
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status)`,
  `CREATE INDEX IF NOT EXISTS idx_disease_reports_user_id ON disease_reports(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_disease_reports_created_at ON disease_reports(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_disease_reports_crop_id ON disease_reports(crop_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts(is_resolved)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_location ON alerts(latitude, longitude)`,
  `CREATE INDEX IF NOT EXISTS idx_crops_user_id ON crops(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_crops_farm_id ON crops(farm_id)`,
  `CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_loss_records_user_id ON loss_prevention_records(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics_snapshots(user_id, snapshot_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_nearby_alerts_user ON nearby_alerts(notified_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes(category)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_weather_snapshots_user_id ON weather_snapshots(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_weather_snapshots_created_at ON weather_snapshots(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_application_logs_created ON application_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_application_logs_source ON application_logs(source, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_history_user_created ON chat_history(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_user_scan ON ai_doctor_tasks(user_id, scan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_doctor_tasks_status ON ai_doctor_tasks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_doctor_recommendations_scan ON ai_doctor_recommendations(scan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_doctor_recommendations_user ON ai_doctor_recommendations(user_id, created_at DESC)`,

  // Updated_at trigger
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
   $$ language 'plpgsql'`,

  ...[
    'users','farms','crops','scans','alerts','community_posts','tasks','schemes','notification_preferences','ai_doctor_tasks','ai_doctor_recommendations'
  ].map(t => `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_${t}_updated_at') THEN
      CREATE TRIGGER update_${t}_updated_at BEFORE UPDATE ON ${t}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END $$`),
];

async function runMigrations() {
  console.log('🚀 Running database migrations...');
  for (const sql of SQL_STATEMENTS) {
    try {
      await query(sql);
    } catch (err) {
      console.error('Migration error on:', sql.slice(0, 80));
      throw err;
    }
  }
  console.log('✅ All migrations completed successfully');
  process.exit(0);
}

runMigrations().catch((e) => { console.error(e); process.exit(1); });
