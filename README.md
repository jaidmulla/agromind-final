# 🌱 AgroMind Regret AI+

> **AI-powered crop disease detection and financial loss prevention for Indian farmers**

AgroMind uses OpenAI Vision + a CNN disease model to detect crop diseases from leaf photos, predict financial losses, and send real-time alerts to nearby farmers — preventing regret before it happens.

---

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│   React +   │───▶│  Node.js +   │───▶│  PostgreSQL 16 │
│  Vite SPA   │    │  Express API │    │   (Database)   │
└─────────────┘    └──────┬───────┘    └────────────────┘
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
    ┌──────────────────┐    ┌──────────────────────┐
    │   OpenAI Vision  │    │  Python FastAPI +     │
    │  (Disease + NLP) │    │  MobileNetV2 CNN      │
    │                  │    │  (PlantVillage CNN)  │
    └──────────────────┘    └──────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔬 **AI Scan** | Upload leaf photo → OpenAI Vision detects disease, calculates ₹ loss |
| 🧠 **CNN Model** | MobileNetV2 trained on PlantVillage (38 disease classes) |
| 😟 **Regret AI** | "If you ignore this, you'll lose ₹45,000 in 5 days" projections |
| 📍 **Nearby Alerts** | Disease outbreaks within 50km notify other farmers automatically |
| 📊 **Analytics** | Real-time charts: loss prevention, crop health, weather disease risk |
| 🌤️ **Weather Risk** | Live OpenWeatherMap data → disease probability score |
| 👥 **Community** | Farmers share success stories with verified savings badges |
| 🔐 **Auth** | JWT-based auth with protected routes |
| 🐳 **Docker** | One-command full-stack deployment |

---

## 📦 Project Structure

```
agromind-fullstack/
├── backend/                  # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── controllers/      # Auth, Scans, Alerts, Analytics, Community...
│   │   ├── routes/           # REST API route definitions
│   │   ├── middleware/       # Auth guard, upload, error handler
│   │   ├── services/         # AI (OpenAI), ML, Weather integrations
│   │   ├── utils/            # DB pool, logger
│   │   ├── migrations/       # run.ts (schema), seed.ts (demo data)
│   │   └── index.ts          # Express app entry point
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/                 # React 18 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # Sidebar, AlertCard, StatBlock...
│   │   │   ├── layouts/      # RootLayout with offline banner
│   │   │   └── pages/        # Dashboard, Scan, Solution, Analytics...
│   │   ├── contexts/         # AuthContext (JWT + user state)
│   │   ├── hooks/            # React Query hooks for all endpoints
│   │   ├── services/         # Axios API service (all endpoints)
│   │   └── types/            # Shared TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
│
├── ml-service/               # Python FastAPI + MobileNetV2
│   ├── main.py               # /predict endpoint + heuristic fallback
│   ├── train.py              # Training script for PlantVillage dataset
│   ├── requirements.txt
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf            # Reverse proxy config
│
├── schema.sql                # Full PostgreSQL schema (reference)
├── docker-compose.yml        # Full-stack orchestration
└── .env.example              # Environment variables template
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 16
- npm or pnpm

### Step 1 — Clone & Configure

```bash
# Copy this project folder, then:
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `.env`, `backend/.env`, and `frontend/.env` with your values:
- **`OPENAI_API_KEY`** — OpenAI API key for AI Doctor + Vision analysis
- **`OPENWEATHER_API_KEY`** — OpenWeatherMap API key for live weather
- **`VITE_MAPBOX_TOKEN`** — Mapbox token for disease map visualization

### Step 2 — Database Setup

```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE USER agromind_user WITH PASSWORD '*********';"
psql -U postgres -c "CREATE DATABASE agromind_db OWNER agromind_user;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE agromind_db TO agromind_user;"

# Run migrations (creates all tables)
cd backend
npm install
npm run migrate

# Seed sample data (optional)
# npm run seed
```

### Step 3 — Start Backend

```bash
# From backend/
npm run dev
# API running at http://localhost:3001
# Test: curl http://localhost:3001/health
```

### Step 4 — Start ML Service

```bash
# From ml-service/
pip install -r requirements.txt
python main.py
# ML API running at http://localhost:5000
# Test: curl http://localhost:5000/health
```

> **Note**: The ML service works without a trained model using heuristic color analysis as fallback.
> To use the full CNN model, see [Training the ML Model](#training-the-ml-model) below.

### Step 5 — Start Frontend

```bash
# From frontend/
npm install
npm run dev
# App running at http://localhost:5173
```

### Step 6 — Login

Open `http://localhost:5173` and use demo credentials:
```
Email:    farmer1@agromind.in
Password: password123
```

---

## 🐳 Docker Deployment (Recommended for Production)

```bash
# 1. Copy and fill environment variables
cp .env.example .env
# Edit .env — set OPENAI_API_KEY and DB_PASSWORD

# 2. Build and start all services
docker-compose up --build -d

# 3. Run migrations inside backend container
docker-compose exec backend npm run migrate
# docker-compose exec backend npm run seed  # optional sample data

# 4. Open the app
open http://localhost
```

**Service ports:**
| Service | Port | URL |
|---|---|---|
| Nginx (main) | 80 | http://localhost |
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |
| ML Service | 5000 | http://localhost:5000 |
| PostgreSQL | 5432 | localhost:5432 |

---

## 🧠 Training the ML Model

The ML service works without a trained model (heuristic fallback). To train the full CNN:

```bash
# 1. Download PlantVillage dataset
# https://www.kaggle.com/datasets/emmarex/plantdisease
# Extract to: ml-service/data/PlantVillage/

# 2. Install training dependencies
cd ml-service
pip install tensorflow pillow numpy

# 3. Train MobileNetV2 (takes 30-60 min on GPU)
python train.py

# Model saved to: ml-service/models/plant_disease_model.h5
# Restart ML service to use trained model
```

---

## 🔌 API Reference

**Base URL:** `http://localhost:3001/api/v1`

All protected routes require: `Authorization: Bearer <token>`

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new farmer |
| POST | `/auth/login` | Login → returns JWT token |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile |
| PUT | `/auth/me/password` | Change password |

### Scans (AI Disease Detection)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/scans` | **Upload image → AI + ML scan** (multipart/form-data, `image` field) |
| GET | `/scans` | List all scans |
| GET | `/scans/:id` | Get scan with full AI result |
| PUT | `/scans/:id/resolve` | Mark resolved → records loss prevention |
| DELETE | `/scans/:id` | Delete scan + image file |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/alerts` | List alerts (filter: severity, is_resolved) |
| GET | `/alerts/stats` | Dashboard stats (totals, loss prevented) |
| GET | `/alerts/nearby` | Disease alerts within 50km |
| PUT | `/alerts/:id/read` | Mark as read |
| PUT | `/alerts/:id/resolve` | Resolve + record prevention |
| DELETE | `/alerts/:id` | Delete alert |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/dashboard` | Total loss prevented, active alerts, crops |
| GET | `/analytics/loss-prevention?range=month` | Chart data (week/month/year) |
| GET | `/analytics/alert-types` | Pie chart breakdown |
| GET | `/analytics/crop-performance` | Per-crop health and yield |
| GET | `/analytics/response-times` | Weekly alert resolution speed |
| GET | `/analytics/weather-risk?lat=&lon=` | Live weather + disease risk score |

### Community
| Method | Endpoint | Description |
|---|---|---|
| GET | `/community/posts` | List posts (filter: crop) |
| POST | `/community/posts` | Create post |
| GET | `/community/map` | Posts with coordinates for map |
| POST | `/community/posts/:id/like` | Toggle like |
| POST | `/community/posts/:id/comments` | Add comment |

### Farms & Crops
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/farms` | List / Create farms |
| GET/PUT/DELETE | `/farms/:id` | Single farm operations |
| GET/POST | `/crops` | List / Create crops |
| GET/PUT/DELETE | `/crops/:id` | Single crop operations |

### Settings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/settings/notifications` | Get notification preferences |
| PUT | `/settings/notifications` | Update preferences |

---

## 🔒 Security

- **Helmet.js** — Secure HTTP headers
- **CORS** — Restricted to frontend URL only
- **Rate Limiting** — 300 req/15min (API), 10 req/15min (login)
- **Bcrypt** — Password hashing (12 rounds)
- **JWT** — 7-day expiry, userId-only payload
- **Multer** — MIME type validation on image upload
- **Sharp** — EXIF stripping before storage
- **Parameterized SQL** — Zero string interpolation in queries

---

## 🌍 Environment Variables

### Backend (`backend/.env`)
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://agromind_user:password123@localhost:5432/agromind_db
JWT_SECRET=your_256bit_secret
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...              ← Required for AI scanning + AI Doctor
OPENAI_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o-mini
ML_SERVICE_URL=http://localhost:5000
OPENWEATHER_API_KEY=...            ← Required for live weather
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:3001/api/v1
VITE_MAPBOX_TOKEN=pk.eyJ...
```

---

## 🧪 Testing the Full Flow

```bash
# 1. Register a new farmer
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Farmer","email":"test@test.com","password":"password123","location":"Pune"}'

# 2. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# 3. Upload a leaf image for AI scan
curl -X POST http://localhost:3001/api/v1/scans \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/leaf.jpg"

# 4. Check dashboard stats
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/analytics/dashboard

# 5. Get active alerts
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/v1/alerts?is_resolved=false"

# 6. Test ML service directly
curl -X POST http://localhost:5000/predict -F "image=@/path/to/leaf.jpg"
```

---

## 📋 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v4, ShadCN UI |
| **State** | TanStack Query (React Query) v5 |
| **Routing** | React Router v7 |
| **Charts** | Recharts |
| **Animations** | Motion (Framer Motion) |
| **Backend** | Node.js 20, Express 4, TypeScript |
| **Database** | PostgreSQL 16 |
| **AI** | OpenAI GPT-4o-mini (Vision) |
| **ML** | Python FastAPI, TensorFlow, MobileNetV2 |
| **Auth** | JWT, bcryptjs |
| **Images** | Multer, Sharp |
| **Proxy** | Nginx Alpine |
| **Deploy** | Docker, Docker Compose |

---

## 🐛 Troubleshooting

**Backend won't connect to DB:**
```bash
# Check PostgreSQL is running
pg_isready -U agromind_user -d agromind_db
# Check connection string in backend/.env
```

**AI scan returns error:**
```bash
# Verify OpenAI API key is set
echo $OPENAI_API_KEY
# Check backend logs
docker-compose logs backend
```

**ML service not responding:**
```bash
# ML service must be running for CNN inference
curl http://localhost:5000/health
# Check: {"status":"ok","model_loaded":false} means heuristic mode
```

**Frontend can't reach API:**
```bash
# Check VITE_API_URL in frontend/.env
# Ensure backend is running on port 3001
curl http://localhost:3001/health
```

---

## 📄 License

MIT License — Use freely for commercial and personal projects.

---

*Built with ❤️ for Indian farmers — preventing crop loss before it becomes regret.*
