# AgroMind Regret AI+ — Comprehensive Architecture Report
**Date:** April 9, 2026  
**Project:** AI-powered crop disease detection and financial loss prevention for Indian farmers

---

## 📋 Executive Summary

AgroMind is a **full-stack agricultural AI platform** combining:
- **OpenAI Vision + CNN** for disease detection
- **Regret AI + behavioral psychology** for farmer motivation
- **Multilingual support** (English, Hindi, Marathi)
- **Real-time community alerts** for disease spread prevention
- **Analytics & loss prevention tracking**

The system runs on **5 microservices** orchestrated by Docker Compose, with PostgreSQL 16 as the core persistence layer.

---

## 🏗️ 1. BACKEND STRUCTURE

### 1.1 Entry Point & Core Setup
**File:** [backend/src/index.ts](backend/src/index.ts)

```
Express App (PORT 3001 default)
├── CORS + Helmet + Rate Limiting
├── JWT Authentication Middleware
├── Static file serving (/uploads)
├── Cron Jobs (weather alerts, daily reminders, analytics snapshots)
└── 10 API Route Groups
```

**Key Routes Mounted:**
- `/api/v1/auth` → Authentication
- `/api/v1/scans` → Disease detection & image analysis
- `/api/v1/alerts` → Alert management
- `/api/v1/chat` → Chat & AI Doctor conversation
- `/api/v1/ai-doctor` → AI Doctor recommendations & tasks
- `/api/v1/farms` → Farm management
- `/api/v1/crops` → Crop management
- `/api/v1/analytics` → Dashboard & analytics
- `/api/v1/community` → Community posts & sharing
- `/api/v1/schemes` → Government scheme matching

### 1.2 Controllers (Business Logic Layer)

Located: [backend/src/controllers/](backend/src/controllers/)

| Controller | Responsibility | Key Endpoints |
|---|---|---|
| **auth.controller.ts** | User registration, login, JWT tokens | POST /register, /login, GET /me |
| **scans.controller.ts** | Upload image → disease detection pipeline | POST /scans, GET /scans/:id |
| **ai-doctor.controller.ts** | AI-generated treatment plans & tasks | GET /recommendations/:scanId, GET /tasks/:scanId |
| **chat.controller.ts** | Conversational AI + language detection | POST /chat, GET /history |
| **alerts.controller.ts** | Create/manage/resolve disease alerts | GET /alerts, PUT /alerts/:id/resolve |
| **analytics.controller.ts** | Dashboard stats, loss prevention, trends | GET /analytics/dashboard |
| **community.controller.ts** | Posts, likes, comments, verified farmers | POST /posts, GET /map |
| **farms.controller.ts** | Farm CRUD + nearby farms detection | POST /farms, GET /nearby |
| **crops.controller.ts** | Crop lifecycle management | POST /crops, PUT /crops/:id |
| **schemes.controller.ts** | Government scheme matching | GET /schemes, GET /inputs/:crop |
| **losses.controller.ts** | Loss prevention record tracking | POST /losses, GET /summary |
| **compat.controller.ts** | Legacy API compatibility routes | GET /api/health/trend |

### 1.3 Services (Integration & AI Layer)

Located: [backend/src/services/](backend/src/services/)

#### **AI & ML Services**
| Service | Purpose |
|---|---|
| **ai.service.ts** | OpenAI Vision integration for disease detection from images |
| **openai.service.ts** | OpenAI API wrapper (chat, image analysis, translations) |
| **local-ai-doctor.service.ts** | **Local Hindi/Marathi AI Doctor** (no API calls, rule-based KB) |
| **ml.service.ts** | Python FastAPI integration for MobileNetV2 CN predictions |

#### **Context & Decision Engines**
| Service | Purpose |
|---|---|
| **context-engine.service.ts** | Builds comprehensive farm context (crops, alerts, weather, user data) for LLM injection |
| **ai-doctor.service.ts** | **6 Decision Engines:** Rule, Context, Cost, Priority, Community, Regret+Urgency |
| **regret.service.ts** | Calculates financial loss projections + urgency messaging |
| **weather.service.ts** | OpenWeatherMap integration + disease risk scoring |

#### **System Services**
| Service | Purpose |
|---|---|
| **alert.service.ts** | Creates alerts, broadcasts to nearby users, notification routing |
| **scheme-matcher.service.ts** | Matches farmers to eligible government schemes |

### 1.4 Routes Organization

Located: [backend/src/routes/](backend/src/routes/)

**Main Routes File:** [index.ts](backend/src/routes/index.ts)
- Imports all route modules
- Instantiates routers with authentication middleware
- Exports for mounting in main app

---

## 🔍 2. DISEASE DETECTION SYSTEM

### 2.1 Disease Detection Pipeline

```
Image Upload → Dual Model Inference → Combined Analysis → Recommendations
     ↓              ↓                        ↓                    ↓
 /api/v1/        1. OpenAI Vision      1. Merge results    AI Doctor Engine
 scans           2. CNN (ML Service)   2. Calculate loss   (generateAIDoctorRecommendations)
                                       3. Regret messaging
```

### 2.2 Scan Lifecycle

**File:** [backend/src/controllers/scans.controller.ts](backend/src/controllers/scans.controller.ts)

**POST /api/v1/scans** (Image Upload)
1. Save image to `/uploads` directory
2. Call `analyzeImageWithAI()` → OpenAI Vision
3. Call `predictWithML()` → Python FastAPI service
4. Merge both predictions (if both available)
5. **Write to `scans` table** with:
   - `disease_name` (detected disease)
   - `confidence` (0-100)
   - `severity` (critical/warning/info/healthy)
   - `potential_loss` (INR)
   - `ml_raw_result` (JSONB from CNN)
   - `ai_response` (JSONB from OpenAI)
   - `recommendation` (treatment plan)
   - `treatment_steps` (array of actions)

### 2.3 OpenAI Vision Integration

**File:** [backend/src/services/ai.service.ts](backend/src/services/ai.service.ts) (lines ~1-150)

```typescript
analyzeImageWithAI(imagePath: string): Promise<AIAnalysisResult>
```

**Inputs:**
- Image file (JPEG, resized to 1024x1024)

**OpenAI Prompt Engineering:**
- System: "AgroMind Regret AI+ — behavioral psychology + disease diagnosis"
- User: JSON schema requesting:
  - Disease name
  - Confidence (0-100)
  - Financial loss in INR
  - **Regret AI messaging** (urgency triggers)
  - 6-step treatment plan with Indian product names
  - Disease info (symptoms, spread, prevention)
  - Behavioral triggers (loss framing, action CTA)

**Output Structure:**
```json
{
  "disease_name": "Early Blight",
  "plant_name": "Tomato",
  "confidence": 92,
  "severity": "warning",
  "potential_loss_inr": 45000,
  "recommendation": "Apply Mancozeb 75% WP at 2.5kg/500L water",
  "regret_insight": "If ignored: 40% yield loss within 5 days = ₹45,000+ loss",
  "treatment_steps": [
    {
      "step": 1,
      "title": "Isolate Affected Area",
      "description": "...",
      "duration": "30 min",
      "product": "Heavy-duty gloves"
    },
    ...
  ],
  "disease_info": {
    "scientific_name": "Alternaria solani",
    "symptoms": ["Brown circular spots with concentric rings", ...],
    "spread_mechanism": "Water splash, high humidity (>60%)",
    "prevention": "Use resistant varieties, improve air circulation"
  },
  "behavioral_triggers": {
    "loss_framing": "Estimated preventable loss: ₹45,000",
    "urgency_statement": "Treat within 24-72 hours for best recovery",
    "social_proof": "Farmers who act in first 48h usually prevent larger losses",
    "action_cta": "Start treatment today and re-scan in 2 days"
  }
}
```

### 2.4 ML Service (CNN) Integration

**File:** [ml-service/main.py](ml-service/main.py)

**Model:** MobileNetV2 trained on PlantVillage dataset (38 disease classes)

**Endpoint:** `POST http://ml-service:5001/predict`
```python
Input: JPEG image (224x224)
Output: {
  "disease": "Early Blight",
  "plant": "Tomato",
  "confidence": 87.3,
  "is_healthy": false,
  "severity": "warning",
  "loss_per_acre_inr": 42000,
  "urgency_days": 5,
  "disease_info": { ... },
  "regret_ai": {
    "message": "If untreated, 40% loss in 3-5 days"
  }
}
```

### 2.5 Disease Database (Local Knowledge)

**File:** [ml-service/data/disease_db.json](ml-service/data/disease_db.json)

Contains 50+ diseases with:
- Common/scientific names
- Plant targets
- Symptoms (5+ descriptions per disease)
- Spread mechanisms
- Indian market treatment products
- Dosages & costs (₹)
- Yield impact (with/without treatment)
- Weekly action plans

---

## 💬 3. CHAT SYSTEM IMPLEMENTATION

### 3.1 Chat Architecture Overview

Located: [backend/src/controllers/chat.controller.ts](backend/src/controllers/chat.controller.ts)

**Dual-Channel System:**
```
User Message
    ↓
Detect Language (Devanagari script + keywords)
    ↓
    ├─→ Hindi/Marathi → Local AI Doctor (Rule-based KB, NO API calls)
    │                   Fast (~400-600ms)
    │
    └─→ English → OpenAI Chat (With farm context injection)
                   Slower (~1500-2500ms)
    ↓
Response
```

### 3.2 Language Detection

**Function:** `detectLanguage(text)` (lines 8-31 of chat.controller.ts)

```typescript
detectLanguage(text: string): 'hi' | 'mr' | 'en' {
  // 1. Devanagari script density: >30% = Hindi/Marathi
  const devanagariDensity = /[\u0900-\u097F]/g matches / text.length
  
  if (devanagariDensity > 0.3) {
    // 2. Differentiate Hindi vs Marathi with keyword detection
    const hindiMarkers = /(हूँ|हूं|है|हैं|को|का|में|और|नहीं)/gi
    const marathiMarkers = /(आहे|आहेत|ला|ने|मध्ये|होते|असे|आणि|नाही)/gi
    return marathiCount > hindiCount ? 'mr' : 'hi'
  }
  return 'en'
}
```

**Detection Accuracy:** ~95%

### 3.3 Local AI Doctor Service (Hindi/Marathi)

**File:** [backend/src/services/local-ai-doctor.service.ts](backend/src/services/local-ai-doctor.service.ts)

**Knowledge Base:** ~200+ Hindi/Marathi templated responses covering:
- **Diseases:** Early Blight, Late Blight, Powdery Mildew, Stem Rot, Leaf Spot (50+ entries)
- **Pests:** Spider mites, bollworms, aphids (10+ entries)
- **Fertilizers:** NPK recommendations by crop
- **Weather:** Rain preparation, frost warnings
- **Government Schemes:** Eligibility advice

**Example Response Structure (Hindi):**
```
नमस्ते! 🌾

आपकी **टमाटर की फसल** में **अर्ली ब्लाइट** का संकेत है।

⚠️ **तुरंत करें:**
1. निचली 30cm की पत्तियां हटा दें
2. आज ही Mancozeb 75% WP 2.5kg per 500L पानी में स्प्रे करें
3. 7 दिन में दोबारा स्प्रे करें

💰 **यदि अभी इलाज न करें:**
- 5 दिन में 40% फसल खराब
- ₹45,000 का नुकसान
- गुणवत्ता में गिरावट

✅ **रोकथाम:** अच्छी हवा चले, कम नमी रखें
```

**Performance:** ~400-600ms response time (no API calls, local only)

### 3.4 English Chat (OpenAI)

**Function:** Chat endpoint for English (lines ~70-150 of chat.controller.ts)

**Context Injection via `buildFarmContext()`:**
```typescript
const farmContext = await buildFarmContext(userId) // Returns:
{
  user: { name, location, farm_size, latitude, longitude },
  crops: [{ name, area, status, health_score }],
  alerts: [{ title, type, severity, created_at }],
  recent_scans: [{ disease_name, severity, plant_name, confidence }],
  weather: { temperature, humidity, rainfall, diseaseRiskScore },
  nearby_alerts_count: number
}
```

**System Prompt** (Injected):
```
You are AgroMind AI Doctor — expert agricultural assistant for Indian farmers.

**Farmer Context:**
- Name: Rajesh Patel
- Location: Kolhapur, Maharashtra
- Farm Size: 5 acres
- Active Crops: Tomato (2 acres, 85 health), Potato (3 acres)
- Recent Disease: Early Blight (Tomato, 92% confidence)
- Weather: 28°C, 65% humidity, disease risk score 72/100

**Always provide:**
- Specific product names available in Indian markets
- ₹ cost estimates
- Step-by-step treatment plans
- Urgency assessment
```

**Return Format:**
```json
{
  "success": true,
  "data": {
    "reply": "Full English response from OpenAI",
    "language": "en",
    "context": {
      "crops_mentioned": ["Tomato"],
      "action_recommended": true,
      "urgency_level": "high"
    },
    "elapsed_ms": 1823
  }
}
```

### 3.5 Chat History Storage

**Function:** `saveChatToHistory()` (context-engine.service.ts)

Stores in database for conversation continuity (not currently exposed as table in schema, but logged/cached).

---

## 🤖 4. AI DOCTOR SYSTEM

### 4.1 AI Doctor Decision Engines

**File:** [backend/src/services/ai-doctor.service.ts](backend/src/services/ai-doctor.service.ts)

**6 Integrated Engines:**

1. **Rule Engine:** Disease → Treatment Product Mapping
   ```typescript
   DISEASE_RULES: {
     'Early Blight': {
       products: [Mancozeb, Chlorothalonil, Carbendazim],
       day_wise_plan: [
         { day: 1, title: 'Scout & Remove Lower Leaves', ... },
         { day: 7, title: 'Second Spray', ... }
       ],
       urgency: 'high',
       cost_estimate: 2500,
       deadline_hours: 48
     },
     'Late Blight': { ... },
     ...
   }
   ```

2. **Context Engine:** Adjusts recommendations based on:
   - Weather conditions
   - Soil type
   - Farm size
   - Crop variety

3. **Cost Engine:** Calculates total treatment cost:
   - Product cost × quantity
   - Labor cost
   - Application cost

4. **Priority Engine:** Assigns urgency:
   - CRITICAL: 24h deadline
   - HIGH: 48-72h deadline
   - MEDIUM: 1 week
   - LOW: Preventive

5. **Community Engine:** References nearby alerts:
   - "Other farmers 5km away detected this 2 days ago"
   - "Treatment success rate in your region: 87%"

6. **Regret + Urgency Engine:** Behavioral psychology triggers:
   - "You have 48 hours before 40% crop loss"
   - "₹45,000 preventable loss if delayed"
   - "Act today, save ₹X tomorrow"

### 4.2 AI Doctor Endpoints

**GET /api/v1/ai-doctor/recommendations/:scanId**

**Query Params:**
- `language` (en/hi/mr)

**Returns:**
```json
{
  "success": true,
  "data": {
    "summary": "Early Blight detected in Tomato crop. Immediate treatment required.",
    "crop_name": "Tomato",
    "disease_name": "Early Blight",
    "severity": "warning",
    "tasks": [
      {
        "day": 1,
        "title": "Scout & Remove Lower Leaves",
        "description": "Inspect field, remove all lower leaves (0-30cm), dispose in sealed bag",
        "product": {
          "name": "Heavy-duty gloves",
          "cost_inr": 150
        },
        "priority": "urgent",
        "urgency_level": "high",
        "reason": "Prevents spread to upper canopy",
        "cost_inr": 150
      },
      {
        "day": 1,
        "title": "First Spray - Mancozeb",
        "description": "Spray Mancozeb 75% WP 2.5kg in 500L water...",
        "product": {
          "name": "Mancozeb 75% WP",
          "cost_inr": 350
        },
        "priority": "urgent",
        "cost_inr": 350
      },
      ...
    ],
    "total_cost_inr": 2850,
    "deadline_hours": 48,
    "urgency": "URGENT - Treat within 48 hours",
    "community_notes": "5 farmers within 10km reported same disease 3 days ago. Success rate with Mancozeb: 87%",
    "weather_impact": "High humidity (68%) + 26°C = Perfect disease spread conditions. Spray before next rain.",
    "loss_warning": "Without treatment: 40-50% yield loss = ₹45,000 loss on 2-acre farm",
    "notes": "Re-scan after 7 days to verify treatment effectiveness"
  }
}
```

**GET /api/v1/ai-doctor/tasks/:scanId**

Returns task checklist for farmer to follow day-by-day.

---

## 📊 5. DATABASE SCHEMA

### 5.1 Core Tables & Relationships

Located: [schema.sql](schema.sql)

```
┌─────────────────────────────────────────────────────┐
│                      USERS                          │
│  id (UUID) | name | email | phone | location       │
│  farm_size | language (en/hi/mr) | latitude        │
│  notification_enabled | push_token                 │
└─────────────────────────────────────────────────────┘
                    ↓ (1:Many)
        ┌───────────┴────────────┐
        ↓                        ↓
┌──────────────┐      ┌──────────────┐
│    FARMS     │      │    CROPS     │
│ id | user_id│      │ id | user_id │
│ name|location│      │ name|farm_id │
└──────────────┘      │ status      │
                      │ health_score│
                      └──────────────┘
                            ↓
                      ┌──────────────┐
                      │    SCANS     │
                      │ id|user_id   │
                      │ image_url    │
                      │ disease_name │
                      │ confidence   │
                      │ ml_raw_result│
                      │ ai_response  │
                      │ source (ml/ai│
                      │  /combined)  │
                      └──────────────┘
                            ↓
                      ┌──────────────┐
                      │    ALERTS    │
                      │ id|user_id   │
                      │ scan_id      │
                      │ title        │
                      │ severity     │
                      │ potential_   │
                      │  loss        │
                      │ latitude     │
                      │ longitude    │
                      └──────────────┘
                            ↓
                    ┌───────────────────┐
                    │  NEARBY_ALERTS    │
                    │ alert_id          │
                    │ notified_user_id  │
                    │ distance_km       │
                    └───────────────────┘
```

### 5.2 Key Table Details

**USERS Table**
- `id` (UUID, PK)
- `name`, `email` (UNIQUE), `password_hash`
- `language` (VARCHAR 10, default 'en') — **Language preference**
- `latitude`, `longitude` — Farm geo-location
- `farm_size`, `farm_size_unit` (acres/hectares)
- `notification_enabled`, `push_token`
- `is_verified` — Email verification status
- Timestamps: `created_at`, `updated_at`

**SCANS Table** (Disease Detection Results)
- `id` (UUID, PK)
- `user_id`, `crop_id`, `farm_id` (FKs)
- `image_url`, `image_filename`
- `disease_name`, `plant_name`, `confidence` (0-100)
- `severity` (critical/warning/info/healthy)
- `potential_loss` (INR), `currency` (default INR)
- `recommendation` (TEXT)
- `treatment_steps` (JSONB array)
- `disease_info` (JSONB)
- `ml_raw_result` (JSONB) — Raw CNN output
- `ai_response` (JSONB) — Raw OpenAI output
- `source` (ml/ai/combined)
- `status` (pending/analyzed/resolved/ignored)
- `resolved_at`, `created_at`, `updated_at`

**ALERTS Table** (Disease Alerts)
- `id` (UUID, PK)
- `user_id`, `scan_id`, `crop_id`, `farm_id` (FKs)
- `title`, `description`, `type` (disease/pest/nutrient/irrigation/weather/system)
- `severity` (critical/warning/info)
- `potential_loss`, `preventable_loss` (INR)
- `confidence` (0-100)
- `latitude`, `longitude` — Geographic location
- `affected_radius_km` (default 5)
- `time_left_seconds` — Urgency countdown
- `is_read`, `is_resolved`, `resolved_at`
- `metadata` (JSONB) — Extra context

**WEATHER_SNAPSHOTS Table**
- `id`, `user_id`
- `latitude`, `longitude`, `city`
- `temperature`, `humidity`, `wind_speed`, `rainfall`, `rain_probability`, `uv_index`
- `condition`, `icon`
- `disease_risk_score` (0-100)
- `risk_factors` (JSONB)

**LOSS_PREVENTION_RECORDS Table**
- `id`, `user_id`
- `alert_id`, `scan_id`, `crop_id` (FKs)
- `amount_prevented` (₹ saved)
- `action_taken` (TEXT)
- `recorded_at`

**COMMUNITY_POSTS Table**
- `id`, `user_id`
- `title`, `content`
- `crop_name`, `location`
- `latitude`, `longitude`
- `action_taken`, `result`, `savings` (₹)
- `image_url`
- `likes_count`, `comments_count`
- `is_verified` — Admin-verified success story

**POST_LIKES & POST_COMMENTS** (Supporting tables)
- Track engagement + farming community insights

---

## 🎨 6. FRONTEND STRUCTURE

### 6.1 File Organization

Located: [frontend/src/](frontend/src/)

```
frontend/src/
├── main.tsx                          # React 18 entry point
├── app/
│   ├── App.tsx                       # Root component
│   ├── components/                   # Reusable UI components
│   │   ├── AIDoctor.tsx              # AI Doctor display modal
│   │   ├── Sidebar.tsx               # Navigation sidebar
│   │   ├── AlertCard.tsx             # Alert visualization
│   │   └── ... (other components)
│   ├── layouts/
│   │   └── RootLayout.tsx            # Main layout wrapper
│   ├── pages/                        # Full-page components
│   │   ├── Dashboard.tsx             # Home dashboard
│   │   ├── Scan.tsx                  # Disease scan upload
│   │   ├── Solution.tsx              # Scan results + treatment plan
│   │   ├── AIDoctorChat.tsx          # Main chat interface
│   │   ├── AIDoctorPage.tsx          # AI Doctor standalone
│   │   ├── Analytics.tsx             # Loss prevention analytics
│   │   ├── WeatherDashboard.tsx      # Weather + disease risk
│   │   ├── Community.tsx             # Success stories & social
│   │   ├── GovernmentSchemes.tsx     # Scheme eligibility
│   │   ├── LossPreventionDashboard.tsx
│   │   ├── ExplainableAI.tsx         # Model explanation
│   │   ├── BeforeAfterSimulation.tsx # "What if" scenarios
│   │   ├── DiseaseMap.tsx            # Geographic heatmap
│   │   ├── Login.tsx                 # Authentication
│   │   ├── Register.tsx              # User onboarding
│   │   ├── Settings.tsx              # User preferences
│   │   └── NotFound.tsx
│   └── routes.tsx                    # React Router config
│
├── contexts/
│   └── AuthContext.tsx               # User auth state + JWT
│
├── hooks/
│   └── [React Query hooks for all endpoints]
│
├── services/
│   └── api.ts                        # Axios API client
│
├── types/
│   └── index.ts                      # TypeScript interfaces
│
└── styles/
    └── [Tailwind CSS + custom styles]
```

### 6.2 Key Pages

| Page | Route | Purpose |
|---|---|---|
| **Dashboard** | `/` | Overview of alerts, recent scans, health score |
| **Scan** | `/scan` | Upload leaf image → instant disease detection |
| **Solution** | `/solution/:id` | Display scan results + AI Doctor recommendations |
| **AIDoctorChat** | `/chat` | Conversational AI (multilingual) + image upload |
| **Analytics** | `/analytics` | Loss prevention trends, response times |
| **WeatherDashboard** | `/weather` | Real-time weather + disease risk scoring |
| **Community** | `/community` | Farmer success stories, verified savings |
| **GovernmentSchemes** | `/schemes` | Scheme matching + eligibility checker |
| **Settings** | `/settings` | User profile, language, notifications |

### 6.3 API Service Layer

**File:** [frontend/src/services/api.ts](frontend/src/services/api.ts)

**Axios Instance Configuration:**
```typescript
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Auth Interceptor: Injects JWT token in all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agromind_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Error Interceptor: 401 → redirect to login
```

**API Modules Exposed:**
- `authApi` — register, login, getMe, updateMe, changePassword
- `scansApi` — create (upload), list, getById, resolve, delete
- `alertsApi` — list, stats, nearby, heatmap, markRead, resolve
- `analyticsApi` — dashboard, lossPrevention, alertTypes, cropPerformance
- `farmsApi` — list, create, getById, update, delete, nearby
- `cropsApi` — list, create, getById, update, delete
- `communityApi` — posts (CRUD), likes, comments
- `chatApi` — sendMessage, getHistory, quickReplies

### 6.4 Key Frontend Components

**AIDoctor.tsx** (Modal Component)
- **Props:** `scanId`, `language` (en/hi/mr), `onClose`
- **Functionality:**
  - Fetches recommendations from `/api/v1/ai-doctor/recommendations/:scanId`
  - Displays day-wise treatment tasks
  - Shows total cost, urgency, community notes
  - Supports Hindi/Marathi translation
- **State:** Loading, error handling, language selection

**AIDoctorChat.tsx** (Full Chat Page)
- **Features:**
  - Language selector (EN/HI/MR)
  - Voice input (Web Speech API)
  - Voice output (Web Speech Synthesis)
  - Image upload for leaf analysis
  - Chat history display
  - Typing indicators
- **Language Support:**
  - Auto-detects language on backend
  - Routes to Local AI Doctor (HI/MR) or OpenAI (EN)
  - No auto-speak (user controls Listen button)

---

## 🎤 7. LANGUAGE & VOICE IMPLEMENTATION

### 7.1 Multilingual Support

**Languages Supported:**
- **English (en)** → OpenAI GPT-4o
- **Hindi (hi)** → Local AI Doctor (Rule-based)
- **Marathi (mr)** → Local AI Doctor (Rule-based)

### 7.2 Language Detection

**Function Location:** [backend/src/controllers/chat.controller.ts](backend/src/controllers/chat.controller.ts) (lines 8-31)

```typescript
function detectLanguage(text: string): 'hi' | 'mr' | 'en' {
  // 1. Devanagari script detection
  const devanagariRegex = /[\u0900-\u097F]/g
  const devanagariDensity = devanagariMatches.length / text.length
  
  if (devanagariDensity > 0.3) {
    // 2. Hindi vs Marathi keyword detection
    const hindiMarkers = /(हूँ|हूं|है|हैं|को|का|में|पर|और|या|नहीं)/gi
    const marathiMarkers = /(आहे|आहेत|ला|ने|मध्ये|होते|असे|आणि|किंवा|नाही)/gi
    
    return marathiCount > hindiCount ? 'mr' : 'hi'
  }
  return 'en'
}
```

**Accuracy:** ~95%

### 7.3 Voice I/O Features

**Frontend (AIDoctorChat.tsx Lines ~100-150):**

**Speech Recognition (Input):**
```typescript
const startListening = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()
  
  recognition.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-US'
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    setInput(transcript)
    sendMessage(transcript)
  }
  recognition.start()
}
```

**Speech Synthesis (Output):**
```typescript
const speakMessage = (text: string, messageIndex: number) => {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-US'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
  setSpeakingMessageIndex(messageIndex)
}
```

**Browser Support:**
- ✅ Chrome, Edge, Safari (iOS 14.5+)
- ✅ Hindi/Marathi recognition requires Chrome 25+
- ⚠️ May require user permission in some browsers

### 7.4 Implementation Notes

**File Tracking:**
- Language support: [backend/src/services/local-ai-doctor.service.ts](backend/src/services/local-ai-doctor.service.ts)
- Voice implementation: [frontend/src/app/pages/AIDoctorChat.tsx](frontend/src/app/pages/AIDoctorChat.tsx)
- Test guide: [VOICE_LANGUAGE_TEST_GUIDE.md](VOICE_LANGUAGE_TEST_GUIDE.md)

---

## 🔌 8. SYSTEM INTEGRATION & ARCHITECTURE

### 8.1 Microservices Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    NGINX Reverse Proxy (port 80/443)         │
└──────────────────┬───────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Frontend│ │ Backend │ │   ML    │
   │:5173    │ │:3001    │ │:5001    │
   │(React)  │ │(Express)│ │(FastAPI)│
   └─────────┘ └────┬────┘ └─────────┘
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
   ┌──────────┐┌──────────┐┌──────────┐
   │PostgreSQL││ Mail Svc ││ OpenAI   │
   │:5432    ││(Nodemailer)
   │(Redis?) ││          │││(API)    │
   └──────────┘└──────────┘└──────────┘
```

**Services:**
1. **Frontend** (React Vite SPA) → Communicates with backend via REST
2. **Backend** (Express Node.js) → Core API, orchestrates ML + AI
3. **ML Service** (Python FastAPI) → MobileNetV2 CNN inference
4. **Database** (PostgreSQL 16) → Persistent storage
5. **External:** OpenAI API, OpenWeatherMap API, Twilio (SMS), Firebase (Push)

### 8.2 Communication Flow: Disease Detection

```
User→ Upload Image
      ↓
  [Scan Page]
      ↓
  POST /api/v1/scans
      ↓
  [Backend REST Handler]
      ├─→ Save image to /uploads
      ├─→ Call analyzeImageWithAI() → OpenAI Vision API
      ├─→ Call predictWithML() → ML Service:5001/predict
      ├─→ Merge results
      ├─→ Write to scans table
      └─→ Return scan result
      ↓
  [Frontend - Solution Page]
      ├─ Display disease name, confidence
      ├─ Show potential loss (₹)
      ├─ Treatment steps
      └─ AIDoctor button
          ↓
      Click "AI Doctor Detailed Plan"
          ↓
      GET /api/v1/ai-doctor/recommendations/:scanId
          ↓
      [AI Doctor Service - 6 Engines]
      └─ Display day-wise treatment + costs
```

### 8.3 Communication Flow: Chat

```
User → Type message in "Ask AI Doctor"
      ↓
  [AIDoctorChat Page]
      ↓
  POST /api/v1/chat
      {
        "message": "मेरे टमाटर में क्या बीमारी है?",
        "language": "hi",
        "history": [...]
      }
      ↓
  [Backend Chat Controller]
      ├─ detectLanguage("मेरे टमाटर...") → returns 'hi'
      ├─ buildFarmContext(userId)
      ├─ Conditional:
      │   ├─ if (language == 'hi' || 'mr')
      │   │  └─ getAIResponse() from LocalAIDoctor
      │   │     └─ Return response immediately (~400-600ms)
      │   └─ else (language == 'en')
      │      └─ createChatCompletion() via OpenAI
      │         └─ Return response (~1500-2500ms)
      └─ saveChatToHistory(userId, message, reply, language)
      ↓
  Return { success: true, data: { reply, language, context, elapsed_ms } }
      ↓
  [Frontend - Display response]
      ├─ Show message in chat
      ├─ Listen button enabled (user chooses to speak)
      └─ Voice output if user clicks Listen
          └─ speechSynthesis.speak() with correct language
```

### 8.4 Cron Jobs (Background Tasks)

**File:** [backend/src/jobs/](backend/src/jobs/)

**Daily Weather Alerts** (`weather-alerts.ts`)
- Runs every 6 hours
- Fetches weather for each user's location
- Calculates disease risk score
- Creates alerts if risk > threshold

**Daily Regret Alerts** (`daily-alerts.ts`)
- Runs every morning (7 AM)
- Reviews unresolved scans from past 7 days
- Sends regret reminders + SMS via Twilio

**Analytics Snapshots** (`analytics-snapshots.ts`)
- Runs daily at midnight
- Aggregates scan counts, alert counts, loss data
- Updates analytics dashboard views

---

## 🗄️ 9. AUTHENTICATION & SECURITY

### 9.1 Auth Flow

**File:** [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts)

```typescript
// Register → Hash password with bcryptjs (10 rounds)
// Login → Verify password → Generate JWT (exp: 7d)
// Protected Routes: Verify JWT token

const token = jwt.sign(
  { id: user.id, email: user.email, name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
)
```

**Token Handling (Frontend):**
```typescript
// Store JWT in localStorage after login
localStorage.setItem('agromind_token', response.data.token)

// Inject in all API requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agromind_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Clear on logout or 401
```

### 9.2 Security Headers

- **Helmet.js:** XSS protection, CSRF, Clickjacking mitigation
- **CORS:** Whitelist frontend origins only
- **Rate Limiting:** 10 attempts/15min for login, 300/15min general
- **Image Processing:** EXIF stripping (sharp library)
- **File uploads:** Multipart size limit 10MB

---

## 📝 10. KEY FILE REFERENCE

### Backend Core
| File | Purpose |
|---|---|
| [backend/src/index.ts](backend/src/index.ts) | Express app setup, route mounting, cron jobs |
| [backend/src/controllers/scans.controller.ts](backend/src/controllers/scans.controller.ts) | Disease detection pipeline logic |
| [backend/src/controllers/chat.controller.ts](backend/src/controllers/chat.controller.ts) | Chat routing + language detection |
| [backend/src/controllers/ai-doctor.controller.ts](backend/src/controllers/ai-doctor.controller.ts) | AI Doctor recommendations endpoint |
| [backend/src/services/ai.service.ts](backend/src/services/ai.service.ts) | OpenAI Vision integration |
| [backend/src/services/local-ai-doctor.service.ts](backend/src/services/local-ai-doctor.service.ts) | Hindi/Marathi KB responses |
| [backend/src/services/ai-doctor.service.ts](backend/src/services/ai-doctor.service.ts) | 6 decision engines |
| [backend/src/services/context-engine.service.ts](backend/src/services/context-engine.service.ts) | Farm data aggregation for LLM |
| [backend/src/services/regret.service.ts](backend/src/services/regret.service.ts) | Loss calculation + urgency messaging |
| [backend/src/routes/index.ts](backend/src/routes/index.ts) | Route definitions + authentication |
| [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts) | JWT validation |

### Frontend Core
| File | Purpose |
|---|---|
| [frontend/src/app/pages/Scan.tsx](frontend/src/app/pages/Scan.tsx) | Upload image → disease detection |
| [frontend/src/app/pages/Solution.tsx](frontend/src/app/pages/Solution.tsx) | Display results + AI Doctor modal |
| [frontend/src/app/pages/AIDoctorChat.tsx](frontend/src/app/pages/AIDoctorChat.tsx) | Main chat interface (EN/HI/MR) + voice |
| [frontend/src/app/components/AIDoctor.tsx](frontend/src/app/components/AIDoctor.tsx) | Reusable AI Doctor display |
| [frontend/src/services/api.ts](frontend/src/services/api.ts) | Axios API client + interceptors |
| [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx) | User auth state management |

### Database
| File | Purpose |
|---|---|
| [schema.sql](schema.sql) | PostgreSQL DDL (users, scans, alerts, crops, etc.) |

### ML Service
| File | Purpose |
|---|---|
| [ml-service/main.py](ml-service/main.py) | FastAPI disease detection endpoint |
| [ml-service/data/disease_db.json](ml-service/data/disease_db.json) | Disease knowledge base |

### Deployment
| File | Purpose |
|---|---|
| [docker-compose.yml](docker-compose.yml) | Production orchestration |
| [Dockerfile](backend/Dockerfile) | Backend container |
| [Dockerfile](frontend/Dockerfile) | Frontend nginx container |

---

## 🚀 11. INTEGRATION POINTS FOR AI DOCTOR SYSTEM

### Current AI Doctor Integration:
1. ✅ **Scan Results Page** → "AI Doctor Detailed Plan" button
2. ✅ **Chat Interface** → Multi-turn conversation with context
3. ✅ **Recommendations Engine** → 6 decision engines

### Optimal Integration for New Features:
1. **Real-time Alerts:** Modify `alert.service.ts` to include AI Doctor summary
2. **Predictive Alerts:** Use regret service to pre-emptively trigger recommendations
3. **Community Insights:** Enhance `community.controller.ts` with verified solutions
4. **Scheme Matching:** Integrate AI Doctor suggestions into `schemes.controller.ts`

---

## 📊 12. PERFORMANCE METRICS

| Operation | Latency | Notes |
|---|---|---|
| Disease scan (OpenAI Vision) | 1500-3000ms | Depends on API |
| Disease scan (CNN/ML) | 800-1200ms | Local inference |
| Chat response (Hindi/Marathi) | 400-600ms | Local AI Doctor |
| Chat response (English) | 1500-2500ms | OpenAI API |
| Nearby alerts calculation | 200-400ms | Geospatial query |
| Analytics dashboard | 300-600ms | Aggregated counts |

---

## 📚 Additional Documentation Files

- [README.md](README.md) — Quick start
- [QUICK_START_CHECKLIST.md](QUICK_START_CHECKLIST.md) — Deployment steps
- [API_ENDPOINTS.md](API_ENDPOINTS.md) — Full API reference
- [VOICE_LANGUAGE_IMPLEMENTATION_SUMMARY.md](VOICE_LANGUAGE_IMPLEMENTATION_SUMMARY.md) — Voice/language details
- [VOICE_LANGUAGE_TEST_GUIDE.md](VOICE_LANGUAGE_TEST_GUIDE.md) — Testing procedures
- [MAP_ANALYSIS_COMPREHENSIVE.md](MAP_ANALYSIS_COMPREHENSIVE.md) — Disease mapping
- [PERSISTENCE.md](PERSISTENCE.md) — Data architecture

---

**Generated:** April 9, 2026  
**For:** AI Doctor System Integration Planning
