# 🌱 AgroMind AI Doctor - Future Startup Guide

## Quick Version (TL;DR)

To run the project again **anytime in the future**:

```bash
cd "/Users/jaid/Documents/Hackethone/DYP Kolhapur/agromind-final"
./run.sh start
```

That's it! ✅ Everything will start automatically.

---

## Three Ways to Run

### 1️⃣ **Easiest (Recommended)**
```bash
./run.sh start
```
- Starts all services automatically
- Shows verification report
- All containers run in background

### 2️⃣ **After Code Changes**
```bash
./run.sh rebuild
```
- Rebuilds TypeScript
- Rebuilds React/Vite
- Rebuilds Docker images
- Takes ~2-3 minutes
- **Use this after editing any code**

### 3️⃣ **Simple Restart**
```bash
docker-compose down
docker-compose up -d
```
- Faster if nothing changed (~30 seconds)
- No rebuild needed

---

## What You'll See

When you run `./run.sh start`:

```
🌱 Starting AgroMind services...
Creating network "agromind-network" with the default driver
Creating agromind-db ...
Creating agromind-ml ...
Creating agromind-backend ...
Creating agromind-frontend ...
Creating agromind-nginx ...

✅ System Check Complete!

📍 Access Points:
   Frontend:   http://localhost:3000
   Backend:    http://localhost:3001/api/v1
   Health:     http://localhost:3001/health

💬 Chat API Ready
🔧 Database Connected
✅ All 5 Services Healthy
```

---

## All Available Commands

```bash
./run.sh start          # Start everything
./run.sh stop           # Stop everything
./run.sh restart        # Restart running services
./run.sh rebuild        # Full rebuild (after code changes)
./run.sh status         # Show container status
./run.sh verify         # Verify all systems healthy

./run.sh logs           # Watch all logs (live)
./run.sh backend        # Watch backend logs only
./run.sh frontend       # Watch frontend logs only
./run.sh db-shell       # Connect to database
./run.sh db-backup      # Backup database
./run.sh help           # Show help
```

---

## Access Points After Startup

| What | URL | Purpose |
|------|-----|---------|
| **Web App** | http://localhost:3000 | Chat interface, login, settings |
| **Backend API** | http://localhost:3001/api/v1 | REST API endpoints |
| **Health Check** | http://localhost:3001/health | Quick status check |
| **Database** | localhost:5432 | Direct PostgreSQL access |
| **ML Service** | http://localhost:5001 | Disease detection API |

---

## Your System Components

After starting, these 5 services run:

```
┌─────────────────────────────────────────┐
│  🌐 FRONTEND (React)                    │
│  http://localhost:3000                  │
│  - Chat UI                              │
│  - Language selection (English/Hindi)   │
│  - Voice input/output                   │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  🔀 NGINX (Reverse Proxy)               │
│  http://localhost:80                    │
│  - Routes to frontend & backend         │
│  - Static file serving                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  🤖 BACKEND (Node.js + TypeScript)      │
│  http://localhost:3001                  │
│ ┌────────────────────────────────────┐ │
│ │ Context Engine Service             │ │
│ │ - Builds farm context              │ │
│ │ - Injects weather data             │ │
│ │ - Routes Hindi/Marathi             │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ Local AI Doctor (Offline KB)       │ │
│ │ - 800+ lines of farming knowledge  │ │
│ │ - Hindi + Marathi support          │ │
│ └────────────────────────────────────┘ │
└────────────────┬────────────────────────┘
                 │
   ┌─────────────┴──────────────┐
   │                            │
┌──▼─────────────────┐  ┌──────▼──────────────┐
│ 🗄️ PostgreSQL      │  │ 🧠 ML Service       │
│ localhost:5432     │  │ http://localhost:5001
│ - User data        │  │ - Disease detection │
│ - Chat history     │  │ - Confidence scores │
│ - Farms & crops    │  │                     │
│ - Alerts & scans   │  │                     │
└────────────────────┘  └─────────────────────┘
```

---

## What's Implemented (Already Running)

✅ **Context-Aware AI Chat**
- Dynamic system prompts with farm data injected
- Real-time weather from Open-Meteo API
- Shows crops, alerts, disease risk in context
- Returns response time metrics

✅ **Multi-Language Support**
- English: OpenAI GPT-4o-mini
- Hindi (हिन्दी): Local AI Doctor service (offline)
- Marathi (मराठी): Local AI Doctor service (offline)

✅ **Chat History Persistence**
- Every conversation saved to database
- Includes full context snapshot
- Can retrieve conversation history anytime

✅ **Fallback System**
- If OpenAI unavailable → uses Local AI Doctor
- Never leaves farmer without answer

✅ **Image Disease Detection**
- Upload leaf image
- AI analyzes with context
- Returns treatment plan with prices (₹)

---

## FAQ: Running in the Future

**Q: How do I start it tomorrow?**
```bash
cd "/Users/jaid/Documents/Hackethone/DYP Kolhapur/agromind-final"
./run.sh start
```

**Q: Do I need to rebuild every time?**
No, only after:
- Code changes (backend/frontend)
- Database schema changes
- Environment variable changes
Otherwise just: `./run.sh start`

**Q: Which URL do I visit?**
- For users: `http://localhost:3000` (chat interface)
- For developers: `http://localhost:3001/api/v1` (API docs)

**Q: Is there an admin dashboard?**
Not yet, but you can:
- View logs: `./run.sh logs`
- Check database: `./run.sh db-shell`
- Monitor API: `./run.sh backend`

**Q: How do I stop it?**
```bash
./run.sh stop
```
All containers shut down gracefully. No data lost.

**Q: Can I test the API directly?**
Yes, requires authentication token:
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What disease affects tomatoes?","language":"en"}'
```

---

## Startup Checklist

When you run the system, verify:

- [ ] All 5 containers show "UP" in `./run.sh status`
- [ ] Backend shows "healthy" in `./run.sh status`
- [ ] Can access http://localhost:3000 (loads HTML)
- [ ] Can access http://localhost:3001/health (shows JSON)
- [ ] Can connect to database with `./run.sh db-shell`
- [ ] `./run.sh verify` shows all green checkmarks

---

## Project Structure

```
agromind-final/
├── backend/                      # Node.js REST API
│   ├── src/
│   │   ├── services/
│   │   │   └── context-engine.service.ts  ⭐ NEW
│   │   ├── controllers/
│   │   │   └── chat.controller.ts          ⭐ UPDATED
│   │   └── routes/
│   │       └── index.ts                    ⭐ UPDATED
│   └── Dockerfile
├── frontend/                     # React Chat UI
│   └── src/app/pages/
│       └── AIDoctorChat.tsx
├── ml-service/                  # Python ML service
│   └── main.py
├── docker-compose.yml            # Service definitions
├── schema.sql                     # Database schema ⭐ UPDATED
├── rebuild.sh                     # Full rebuild script
├── run.sh                         # Quick commands ⭐ NEW
├── verify-system.sh              # Health check ⭐ NEW
├── STARTUP_GUIDE.md              # This guide ⭐ NEW
└── README.md
```

---

## Key Ports

| Port | Service | Access |
|------|---------|--------|
| 80 | Nginx (proxy) | http://localhost |
| 3000 | Frontend | http://localhost:3000 |
| 3001 | Backend API | http://localhost:3001 |
| 5001 | ML Service | http://localhost:5001 |
| 5432 | PostgreSQL | localhost:5432 |

---

## Environment Setup

Current system uses these critical settings (in `.env`):

```
OPENAI_API_KEY=sk-... (needed for English chat)
DB_USER=agromind_user
DB_PASSWORD=password123
JWT_SECRET=your-secret-key
```

These work out of the box for local development.

---

## Last Startup

**Date**: April 9, 2026
**Time**: 08:07:01 UTC+5:30
**Status**: ✅ All systems healthy
**Database**: ✅ Connected (0 chat records)
**Backend**: ✅ Running normally
**Context Engine**: ✅ Ready

---

## Emergency Commands

```bash
# If something breaks, try these in order:

# 1. Restart containers
./run.sh restart

# 2. Check logs for errors
./run.sh logs

# 3. Stop and start fresh
./run.sh stop
./run.sh start

# 4. Full rebuild if nothing works
./run.sh rebuild

# 5. Nuclear option (deletes everything, starts fresh)
./run.sh clean
./run.sh start
```

---

**Now you're ready!** 🚀

Just run: `./run.sh start`

And visit: http://localhost:3000
