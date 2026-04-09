# AI Doctor System - Testing & Deployment Guide

## 🧪 Testing Protocol

### Test Case 1: Early Blight (Critical Scenario)
**Objective:** Verify system handles critical disease with adverse weather

**Setup:**
- Disease: Early Blight
- Severity: Critical (85%+ confidence)
- Humidity: 85%
- Temperature: 32°C
- Rain: Expected
- Nearby Alerts: 5+

**Expected Results:**
- ⏱️ Deadline: 24-36 hours (< 48h due to weather)
- 💰 Total Cost: ₹2,500
- 🔴 Urgent Tasks: 3-5
- 📍 Location: Test with Mumbai/Pune coordinates
- 🌐 Languages: Test EN, HI, MR response

**Verification Checklist:**
- [ ] API returns proper JSON structure
- [ ] Weather data fetched correctly
- [ ] Deadline reduced due to humidity/rain
- [ ] All 5 tasks generated
- [ ] Costs calculated correctly
- [ ] Community context shows: "5 farmers facing same issue"
- [ ] Loss warning displays: "₹12,000+ at risk"
- [ ] Frontend renders without errors
- [ ] Task checkboxes functional
- [ ] Translations work in all 3 languages

**API Call:**
```bash
curl -X GET "http://localhost:3001/api/v1/ai-doctor/recommendations/{scanId}?language=hi" \
  -H "Authorization: Bearer {token}"
```

---

### Test Case 2: Late Blight (Emergency 24-hour Response)
**Objective:** Verify emergency protocol triggers

**Setup:**
- Disease: Late Blight
- Severity: Critical
- Humidity: 90%
- Temperature: 22°C (monsoon)
- Rain: YES (heavy expected)

**Expected Results:**
- ⏱️ Deadline: 18-24 hours (critical urgency)
- 💰 Total Cost: ₹4,000 (highest cost fungicide)
- 🔴 First Task: "EMERGENCY SPRAY - 24 hours"
- ⚠️ Loss Warning: ₹15,000+

**Verification:**
- [ ] First task marked as "urgent" (red)
- [ ] Deadline shows "Act within 24 hours"
- [ ] Metalaxyl+Mancozeb product selected
- [ ] Command executed: remove infected parts
- [ ] Weather impact: "Rain expected - apply BEFORE rainfall"

---

### Test Case 3: Yellow Mosaic (Viral + Community Alert)
**Objective:** Verify vector control + community integration

**Setup:**
- Disease: Yellow Mosaic Virus
- Severity: High
- Nearby Alerts: 8 farmers (critical spread)
- Crop: Okra, location: Rural Maharashtra

**Expected Results:**
- 🔴 Community Alert: "🚨 CRITICAL SPREAD ALERT: 8 farmers in your region..."
- 💊 Products: Neem Oil + Imidacloprid (vector control)
- 💰 Cost: ₹2,400
- 📱 First task: "Remove infected plant" (isolation)
- 🔄 Control sprays: Every 5 days for 4 weeks

**Verification:**
- [ ] Community notes display with "8 farmers"
- [ ] First task is removal (not spray)
- [ ] Imidacloprid quantity correct (300ml/500L)
- [ ] 4 tasks total (removal + 3 sprays)
- [ ] Share feature works for success stories

---

### Test Case 4: Healthy Crop (Preventive Protocol)
**Objective:** Verify healthy crop doesn't trigger false positives

**Setup:**
- Disease: Healthy
- Severity: Healthy
- Confidence: >98%
- No nearby alerts

**Expected Results:**
- 🟢 No cost (₹0)
- ✅ Preventive tasks only
- ⏰ No urgency ("Plan within 3 days")
- 📋 Tasks: Weekly monitoring, NPK fertilizer, crop rotation

**Verification:**
- [ ] No red/orange urgency indicators
- [ ] All tasks blue (optional)
- [ ] "Continue Monitoring" is main task
- [ ] No loss warning
- [ ] Community notes: "No similar reports..."

---

### Test Case 5: Spider Mites (Low Severity, Dry Season)
**Objective:** Verify low-urgency pest management

**Setup:**
- Disease: Spider Mites
- Severity: Info/Low
- Humidity: 40%
- Temperature: 35°C (dry season)
- Nearby Alerts: 0

**Expected Results:**
- 🟡 Recommended priority (yellow)
- ⏰ Deadline: 60+ hours (low urgency)
- 💰 Cost: ₹1,900
- 🔄 Spray schedule: 7-day intervals
- 🌡️ Context: "Low humidity reduces mite pressure"

**Verification:**
- [ ] Tasks marked "recommended" (yellow)
- [ ] Sulfur 80% WP selected
- [ ] Watering instructions (humidity increase)
- [ ] Optional Dicofol switch after 14 days
- [ ] Weather impact: "Current conditions moderate"

---

## 🚀 Deployment Steps

### Step 1: Build Backend
```bash
cd backend
npm run build
npm run lint  # Check for errors
```

### Step 2: Build Frontend  
```bash
cd frontend
npm run build
npm run lint  # Check for errors
```

### Step 3: Run Containers
```bash
cd /path/to/project
./rebuild.sh
docker-compose up -d
```

### Step 4: Verify Services
```bash
./verify-system.sh
```

Expected output:
```
✅ PostgreSQL 16 running
✅ Redis running
✅ Backend API (3001) running
✅ Frontend (5173) running
✅ ML Service (5001) running
✅ All 5 services healthy
```

### Step 5: Smoke Test
```bash
# Test health endpoint
curl http://localhost:3001/api/v1/health

# Response:
# {"status":"ok","timestamp":"2026-04-09T...","version":"1.0.0"}
```

### Step 6: Create Test User
1. Go to http://localhost:5173/register
2. Create account: test@agromind.local / password123
3. Verify email confirmation works

### Step 7: End-to-End Test
1. **Upload Disease Image**
   - Go to /scan
   - Upload tomato leaf image
   - Verify scan created

2. **Generate Recommendations**
   - Click "Get AI Doctor Recommendation"
   - Wait for API response (2-3 seconds)
   - Verify all 6 components rendered

3. **Complete Tasks**
   - Check off tasks one by one
   - Verify progress bar updates
   - Check /ai-doctor-tasks dashboard

4. **Test Languages**
   - Switch to Hindi (हिंदी)
   - Verify translations applied
   - Switch to Marathi (मराठी)
   - Verify translations applied

---

## 📊 Performance Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| API Response Time | <500ms | _____ |
| Frontend Load | <2s | _____ |
| Database Query | <100ms | _____ |
| Translation Time | <50ms | _____ |
| Total Task Creation | <1s | _____ |

---

## ⚠️ Known Limitations

1. **Weather API:** Requires internet (OpenMeteo is fallback-safe)
2. **Language Accuracy:** Hindi/Marathi ~90% (human review recommended)
3. **Image Upload:** Max 10MB, JPEG/PNG only
4. **Concurrent Users:** Tested for 100+ simultaneous connections

---

## 🔧 Troubleshooting

### Issue: "Failed to fetch weather data"
**Solution:** System falls back to default values (65% humidity, 25°C). Not critical.

### Issue: "Translation function not found"
**Solution:** Ensure `translateRecommendations` is imported in ai-doctor.controller.ts

### Issue: "Task not saving to database"
**Solution:** Check PostgreSQL is running: `docker-compose ps | grep postgres`

### Issue: "Frontend route not working"
**Solution:** Clear browser cache, rebuild frontend, restart dev server

---

## ✅ Pre-Deployment Checklist

- [ ] All 18 diseases have rule mappings
- [ ] Weather API integration tested
- [ ] Multilingual support verified (EN/HI/MR)
- [ ] Frontend components render without console errors
- [ ] Database schema has `ai_doctor_tasks` table
- [ ] API endpoints return proper language-specific responses
- [ ] Task completion tracking works
- [ ] Dashboard shows statistics correctly
- [ ] No hardcoded API keys in code
- [ ] Error handling implemented for all endpoints
- [ ] Rate limiting configured
- [ ] CORS policies allow frontend origin
- [ ] Backup strategy in place for PostgreSQL

---

## 📞 Support

For issues contact: support@agromind.local

**Expected Response Time:** 24-48 hours

---

*Document Version: 1.0 | Date: April 9, 2026*
