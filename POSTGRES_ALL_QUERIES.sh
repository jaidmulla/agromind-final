#!/bin/bash
# ================================================================================
# AGROMIND POSTGRESQL - COMPLETE SETUP & QUERY GUIDE
# Copy-Paste Ready - Single Click Selection
# ================================================================================

# ================================================================================
# SECTION 1: CONNECTION COMMANDS
# ================================================================================

psql -U postgres -h localhost -p 5432
psql -U agromind_user -h localhost -p 5432 -d agromind_db
psql postgresql://agromind_user:password123@localhost:5432/agromind_db
docker exec -it agromind-db psql -U agromind_user -d agromind_db
docker exec agromind-db pg_isready -U agromind_user

# ================================================================================
# SECTION 2: DATABASE & USER SETUP
# ================================================================================

CREATE DATABASE agromind_db;
CREATE USER agromind_user WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE agromind_db TO agromind_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agromind_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agromind_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO agromind_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO agromind_user;

# ================================================================================
# SECTION 3: VERIFY CONNECTION
# ================================================================================

\l
\du
SELECT version();
SELECT current_user;
SELECT current_database();
SELECT inet_server_addr(), inet_server_port();
\dt
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

# ================================================================================
# SECTION 4: CREATE USERS TABLE
# ================================================================================

CREATE TABLE users (
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
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

# ================================================================================
# SECTION 5: CREATE FARMS TABLE
# ================================================================================

CREATE TABLE farms (
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
);

CREATE INDEX idx_farms_user_id ON farms(user_id);
CREATE INDEX idx_farms_location ON farms(location);

# ================================================================================
# SECTION 6: CREATE CROPS TABLE
# ================================================================================

CREATE TABLE crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    planting_date DATE,
    expected_harvest DATE,
    area_planted DECIMAL(10,2),
    area_unit VARCHAR(10) DEFAULT 'acres',
    crop_stage VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crops_user_id ON crops(user_id);
CREATE INDEX idx_crops_farm_id ON crops(farm_id);
CREATE INDEX idx_crops_status ON crops(status);

# ================================================================================
# SECTION 7: CREATE SCANS TABLE
# ================================================================================

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    image_url VARCHAR(500),
    image_filename VARCHAR(255),
    disease_name VARCHAR(255),
    plant_name VARCHAR(100),
    confidence DECIMAL(5,2),
    severity VARCHAR(50),
    potential_loss DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'INR',
    recommendation TEXT,
    regret_insight TEXT,
    treatment_steps JSONB,
    disease_info JSONB,
    ml_raw_result JSONB,
    ai_response JSONB,
    source VARCHAR(50),
    status VARCHAR(50) DEFAULT 'analyzed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_crop_id ON scans(crop_id);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX idx_scans_disease ON scans(disease_name);

# ================================================================================
# SECTION 8: CREATE ALERTS TABLE
# ================================================================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    alert_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

# ================================================================================
# SECTION 9: CREATE NOTIFICATION LOGS TABLE
# ================================================================================

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    recipient VARCHAR(255),
    content TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);

# ================================================================================
# SECTION 10: CREATE AI DOCTOR TASKS TABLE
# ================================================================================

CREATE TABLE ai_doctor_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
    day INTEGER,
    title VARCHAR(255),
    description TEXT,
    product_name VARCHAR(255),
    quantity VARCHAR(100),
    cost_inr DECIMAL(10,2),
    priority VARCHAR(50),
    urgency_level VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    disease_name VARCHAR(255),
    disease_severity VARCHAR(50),
    weather_context VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_doctor_tasks_user_scan ON ai_doctor_tasks(user_id, scan_id);
CREATE INDEX idx_ai_doctor_tasks_status ON ai_doctor_tasks(status);
CREATE INDEX idx_ai_doctor_tasks_priority ON ai_doctor_tasks(priority);
CREATE INDEX idx_ai_doctor_tasks_created_at ON ai_doctor_tasks(created_at DESC);

# ================================================================================
# SECTION 11: CREATE AI DOCTOR RECOMMENDATIONS TABLE
# ================================================================================

CREATE TABLE ai_doctor_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
    summary TEXT,
    crop_name VARCHAR(100),
    disease_name VARCHAR(255),
    severity VARCHAR(50),
    total_cost_inr DECIMAL(10,2),
    deadline_hours INTEGER,
    urgency VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_doctor_recs_user_created ON ai_doctor_recommendations(user_id, created_at DESC);
CREATE INDEX idx_ai_doctor_recs_scan_id ON ai_doctor_recommendations(scan_id);
CREATE INDEX idx_ai_doctor_recs_created_at ON ai_doctor_recommendations(created_at DESC);

# ================================================================================
# SECTION 12: CREATE ANALYTICS SNAPSHOTS TABLE
# ================================================================================

CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_scans INTEGER DEFAULT 0,
    scans_today INTEGER DEFAULT 0,
    diseases_detected INTEGER DEFAULT 0,
    critical_alerts INTEGER DEFAULT 0,
    avg_crop_health DECIMAL(5,2),
    estimated_loss_inr DECIMAL(12,2),
    top_diseases JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_user_created ON analytics_snapshots(user_id, created_at DESC);

# ================================================================================
# SECTION 13: CREATE CHAT HISTORY TABLE
# ================================================================================

CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    message_type VARCHAR(50),
    message_text TEXT,
    ai_response TEXT,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_user_session ON chat_history(user_id, session_id);
CREATE INDEX idx_chat_created_at ON chat_history(created_at DESC);

# ================================================================================
# SECTION 14: CREATE WEATHER ALERTS TABLE
# ================================================================================

CREATE TABLE weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255),
    alert_type VARCHAR(50),
    description TEXT,
    disease_risk VARCHAR(50),
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    rainfall DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_alerts_user ON weather_alerts(user_id);
CREATE INDEX idx_weather_alerts_location ON weather_alerts(location);

# ================================================================================
# SECTION 15: CREATE COMMUNITY POSTS TABLE
# ================================================================================

CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT,
    category VARCHAR(100),
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_user_id ON community_posts(user_id);
CREATE INDEX idx_community_category ON community_posts(category);
CREATE INDEX idx_community_created_at ON community_posts(created_at DESC);

# ================================================================================
# SECTION 16: CREATE GOVERNMENT SCHEMES TABLE
# ================================================================================

CREATE TABLE gov_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name VARCHAR(255) NOT NULL,
    description TEXT,
    eligibility TEXT,
    benefits JSONB,
    state VARCHAR(100),
    min_age INTEGER,
    max_age INTEGER,
    application_url VARCHAR(500),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schemes_state ON gov_schemes(state);

# ================================================================================
# SECTION 17: INSERT DATA - USERS
# ================================================================================

INSERT INTO users (name, email, password_hash, phone, location) VALUES ('Farmer John', 'john@agromind.test', 'hashed_pwd_123', '9876543210', 'Kolhapur');
INSERT INTO users (name, email, password_hash, phone, location) VALUES ('Farmer Raj', 'raj@agromind.test', 'hashed_pwd_456', '8765432109', 'Pune');
INSERT INTO users (name, email, password_hash, phone, location) VALUES ('Farmer Priya', 'priya@agromind.test', 'hashed_pwd_789', '7654321098', 'Satara');

# ================================================================================
# SECTION 18: INSERT DATA - FARMS
# ================================================================================

INSERT INTO farms (user_id, name, location, total_area) VALUES ('user-uuid-here', 'Main Farm', 'Kolhapur', 50.5);
INSERT INTO farms (user_id, name, location, total_area) VALUES ('user-uuid-here', 'North Field', 'Kolhapur', 30.0);

# ================================================================================
# SECTION 19: INSERT DATA - CROPS
# ================================================================================

INSERT INTO crops (farm_id, user_id, name, variety, planting_date, status) VALUES ('farm-uuid-here', 'user-uuid-here', 'Potato', 'Jyoti', '2024-01-15', 'active');
INSERT INTO crops (farm_id, user_id, name, variety, planting_date, status) VALUES ('farm-uuid-here', 'user-uuid-here', 'Tomato', 'Roma', '2024-02-20', 'active');
INSERT INTO crops (farm_id, user_id, name, variety, planting_date, status) VALUES ('farm-uuid-here', 'user-uuid-here', 'Onion', 'Nashik', '2024-03-10', 'active');

# ================================================================================
# SECTION 20: INSERT DATA - SCANS
# ================================================================================

INSERT INTO scans (user_id, crop_id, farm_id, image_url, disease_name, plant_name, confidence, severity) VALUES ('user-uuid', 'crop-uuid', 'farm-uuid', '/uploads/scan_001.jpg', 'Early Blight', 'Potato', 87.5, 'High');
INSERT INTO scans (user_id, crop_id, farm_id, image_url, disease_name, plant_name, confidence, severity) VALUES ('user-uuid', 'crop-uuid', 'farm-uuid', '/uploads/scan_002.jpg', 'Septoria Leaf Spot', 'Tomato', 92.3, 'Critical');
INSERT INTO scans (user_id, crop_id, farm_id, image_url, disease_name, plant_name, confidence, severity) VALUES ('user-uuid', 'crop-uuid', 'farm-uuid', '/uploads/scan_003.jpg', 'Healthy', 'Onion', 98.1, 'Low');

# ================================================================================
# SECTION 21: INSERT DATA - ALERTS
# ================================================================================

INSERT INTO alerts (user_id, crop_id, alert_type, title, message, severity) VALUES ('user-uuid', 'crop-uuid', 'disease', 'Disease Alert', 'Early Blight detected in Potato', 'High');
INSERT INTO alerts (user_id, crop_id, alert_type, title, message, severity) VALUES ('user-uuid', 'crop-uuid', 'weather', 'Weather Alert', 'Heavy rain expected in next 3 days', 'Medium');
INSERT INTO alerts (user_id, crop_id, alert_type, title, message, severity) VALUES ('user-uuid', 'crop-uuid', 'pest', 'Pest Alert', 'Spider mites detected', 'High');

# ================================================================================
# SECTION 22: INSERT DATA - AI DOCTOR TASKS
# ================================================================================

INSERT INTO ai_doctor_tasks (user_id, scan_id, day, title, product_name, cost_inr, priority, status) VALUES ('user-uuid', 'scan-uuid', 1, 'Spray fungicide', 'Bordeaux Mixture', 450.00, 'high', 'pending');
INSERT INTO ai_doctor_tasks (user_id, scan_id, day, title, product_name, cost_inr, priority, status) VALUES ('user-uuid', 'scan-uuid', 2, 'Apply neem oil', 'Neem Oil 3%', 350.00, 'high', 'pending');
INSERT INTO ai_doctor_tasks (user_id, scan_id, day, title, product_name, cost_inr, priority, status) VALUES ('user-uuid', 'scan-uuid', 3, 'Irrigation', 'Water', 0.00, 'medium', 'pending');

# ================================================================================
# SECTION 23: VIEW DATA - USERS
# ================================================================================

SELECT id, name, email, phone, location, created_at FROM users;
SELECT COUNT(*) as total_users FROM users;
SELECT * FROM users WHERE email = 'john@agromind.test';

# ================================================================================
# SECTION 24: VIEW DATA - FARMS
# ================================================================================

SELECT id, name, location, total_area FROM farms;
SELECT COUNT(*) as total_farms FROM farms;
SELECT * FROM farms WHERE user_id = 'user-uuid-here';

# ================================================================================
# SECTION 25: VIEW DATA - CROPS
# ================================================================================

SELECT id, name, variety, status, created_at FROM crops;
SELECT COUNT(*) as total_crops FROM crops;
SELECT * FROM crops WHERE user_id = 'user-uuid-here' AND status = 'active';

# ================================================================================
# SECTION 26: VIEW DATA - SCANS
# ================================================================================

SELECT id, plant_name, disease_name, confidence, severity, created_at FROM scans ORDER BY created_at DESC;
SELECT COUNT(*) as total_scans FROM scans;
SELECT * FROM scans WHERE user_id = 'user-uuid-here' ORDER BY created_at DESC LIMIT 10;
SELECT DISTINCT disease_name, COUNT(*) as count FROM scans GROUP BY disease_name ORDER BY count DESC;

# ================================================================================
# SECTION 27: VIEW DATA - ALERTS
# ================================================================================

SELECT id, alert_type, title, message, severity, status FROM alerts;
SELECT COUNT(*) as total_alerts FROM alerts WHERE status = 'active';
SELECT * FROM alerts WHERE user_id = 'user-uuid-here' ORDER BY created_at DESC LIMIT 5;

# ================================================================================
# SECTION 28: VIEW DATA - AI DOCTOR TASKS
# ================================================================================

SELECT id, title, product_name, cost_inr, priority, status FROM ai_doctor_tasks;
SELECT COUNT(*) as total_tasks FROM ai_doctor_tasks WHERE status = 'pending';
SELECT * FROM ai_doctor_tasks WHERE user_id = 'user-uuid-here' ORDER BY created_at DESC;

# ================================================================================
# SECTION 29: STATISTICS & ANALYTICS
# ================================================================================

SELECT u.name as farmer, COUNT(DISTINCT f.id) as total_farms, COUNT(DISTINCT c.id) as total_crops, COUNT(DISTINCT s.id) as total_scans, COUNT(DISTINCT CASE WHEN s.disease_name != 'Healthy' THEN s.id END) as disease_detections FROM users u LEFT JOIN farms f ON u.id = f.user_id LEFT JOIN crops c ON u.id = c.user_id LEFT JOIN scans s ON u.id = s.user_id WHERE u.id = 'user-uuid-here' GROUP BY u.id, u.name;

SELECT crop_id, disease_name, COUNT(*) as occurrences, MAX(created_at) as last_detected FROM scans GROUP BY crop_id, disease_name ORDER BY last_detected DESC;

SELECT DATE(created_at) as scan_date, COUNT(*) as scans_per_day FROM scans GROUP BY DATE(created_at) ORDER BY scan_date DESC LIMIT 30;

SELECT disease_name, COUNT(*) as count, AVG(confidence) as avg_confidence FROM scans GROUP BY disease_name ORDER BY count DESC;

SELECT severity, COUNT(*) as count FROM scans GROUP BY severity;

SELECT plant_name, COUNT(*) as count FROM scans GROUP BY plant_name;

# ================================================================================
# SECTION 30: UPDATE DATA
# ================================================================================

UPDATE users SET name = 'John Doe', phone = '9876543210', updated_at = NOW() WHERE id = 'user-uuid-here';
UPDATE users SET language = 'hi', updated_at = NOW() WHERE email = 'john@agromind.test';

UPDATE farms SET soil_type = 'Loamy', total_area = 75.5, updated_at = NOW() WHERE id = 'farm-uuid-here';

UPDATE crops SET status = 'harvested', crop_stage = 'post-harvest', updated_at = NOW() WHERE id = 'crop-uuid-here';

UPDATE scans SET status = 'reviewed', updated_at = NOW() WHERE id = 'scan-uuid-here';

UPDATE alerts SET status = 'read', updated_at = NOW() WHERE id = 'alert-uuid-here';

UPDATE ai_doctor_tasks SET status = 'completed', updated_at = NOW() WHERE id = 'task-uuid-here';

# ================================================================================
# SECTION 31: DELETE DATA
# ================================================================================

DELETE FROM scans WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM alerts WHERE status = 'read' AND created_at < NOW() - INTERVAL '30 days';
DELETE FROM scans WHERE id = 'scan-uuid-here';
DELETE FROM alerts WHERE id = 'alert-uuid-here';
DELETE FROM users WHERE id = 'user-uuid-here';

# ================================================================================
# SECTION 32: BACKUP & RESTORE
# ================================================================================

pg_dump -U agromind_user -h localhost -d agromind_db > backup.sql
docker exec agromind-db pg_dump -U agromind_user -d agromind_db > backup.sql
psql -U agromind_user -h localhost -d agromind_db < backup.sql
docker exec -i agromind-db psql -U agromind_user -d agromind_db < backup.sql
docker exec -i agromind-db psql -U agromind_user -d agromind_db < postgres.db.sql

# ================================================================================
# SECTION 33: QUICK TESTS
# ================================================================================

docker exec agromind-db pg_isready -U agromind_user
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT version();"
docker exec agromind-db psql -U agromind_user -d agromind_db -c "\dt"
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT COUNT(*) FROM users;"
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT COUNT(*) FROM scans;"
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT pg_size_pretty(pg_database_size('agromind_db'));"

# ================================================================================
# END - ALL QUERIES IN SINGLE PAGE
# ================================================================================
