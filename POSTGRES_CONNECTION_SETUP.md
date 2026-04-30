# AGROMIND POSTGRESQL CONFIGURATION & SETUP GUIDE

## 🔗 DATABASE CONNECTION SETUP

### Step 1: Environment Variables
The backend uses environment variables from docker-compose.yml:
- DATABASE_URL: postgresql://agromind_user:password123@postgres:5432/agromind_db
- DB_HOST: postgres
- DB_PORT: 5432
- DB_NAME: agromind_db
- DB_USER: agromind_user
- DB_PASSWORD: password123

### Step 2: Verify Database Connection
```bash
# Check if database is ready
docker exec agromind-db pg_isready -U agromind_user -d agromind_db

# Test connection with query
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT NOW();"
```

### Step 3: Run Database Migrations
```bash
# Execute all migrations to create tables
docker exec agromind-backend npm run migrate

# Seed with sample data (optional)
docker exec agromind-backend npm run seed
```

### Step 4: Verify Tables Created
```bash
# List all tables
docker exec agromind-db psql -U agromind_user -d agromind_db -c "\dt"

# Check specific table
docker exec agromind-db psql -U agromind_user -d agromind_db -c "\d users"
```

---

## 📁 PROJECT FILES STRUCTURE

```
agromind-final/
├── backend/
│   ├── src/
│   │   ├── utils/database.ts          ✅ Database connection pool
│   │   ├── middleware/auth.ts         ✅ Authentication
│   │   ├── controllers/               ✅ API endpoint handlers
│   │   ├── services/                  ✅ Business logic
│   │   ├── routes/                    ✅ API routes
│   │   ├── migrations/
│   │   │   ├── run.ts                 ✅ Create all tables
│   │   │   └── seed.ts                ✅ Insert sample data
│   │   └── index.ts                   ✅ Express app setup
│   └── package.json                    ✅ Dependencies (pg, prisma)
├── docker-compose.yml                  ✅ PostgreSQL service config
└── postgres.db.sql                     ✅ Complete SQL schema (created)
```

---

## 🔐 DATABASE CONNECTION FILES

### 1. backend/src/utils/database.ts (ALREADY EXISTS)
✅ Provides database connection pool using 'pg' library
✅ Handles connection errors and timeouts
✅ Exports query(), getClient(), transaction() helpers

### 2. backend/src/migrations/run.ts (ALREADY EXISTS)
✅ Contains all SQL table creation statements
✅ Creates users, farms, crops, scans, alerts, etc.
✅ Can be run via: `npm run migrate`

### 3. backend/package.json (ALREADY EXISTS)
✅ Has "pg" dependency for PostgreSQL
✅ Has "dotenv" for environment variables
✅ Has scripts: migrate, seed, build, start

### 4. docker-compose.yml (ALREADY CONFIGURED)
✅ PostgreSQL service on port 5432
✅ Backend service with DATABASE_URL env var
✅ Health checks enabled

---

## ✅ ALREADY CONNECTED TO POSTGRESQL

### Backend Connection Points:

1. **Database Connection Pool** (utils/database.ts)
   - Creates connection pool from DATABASE_URL
   - Handles connection errors
   - Provides query() function for executing SQL

2. **All Controllers** (controllers/*.ts)
   - Import { query } from '../utils/database'
   - Use query() to execute SQL statements
   - All operations go through database.ts pool

3. **All Services** (services/*.ts)
   - Import { query } from '../utils/database'
   - Implement business logic
   - Database queries via pool

4. **Authentication** (middleware/auth.ts)
   - Validates JWT tokens
   - Checks against users table in database
   - User verification before accessing routes

5. **Background Jobs** (jobs/*.ts)
   - Daily alerts job
   - Weather alerts job
   - Analytics snapshots job
   - All use database connection

---

## 🚀 START EVERYTHING

```bash
# Start all services
cd /Users/jaid/Documents/Hackethone/DYP\ Kolhapur/agromind-final
docker-compose up -d

# Verify all services running
docker-compose ps

# Create database tables (first time only)
docker exec agromind-backend npm run migrate

# Backend is at: http://localhost:3001
# Frontend is at: http://localhost:3000
# Database is at: localhost:5432
```

---

## 📊 VERIFY DATABASE IS WORKING

```bash
# Test database endpoint
curl http://localhost:3001/test-db

# Expected response:
# {
#   "success": true,
#   "time": {"now": "2026-05-01T..."},
#   "message": "DB Connected ✅"
# }
```

---

## 🧪 TEST DATABASE OPERATIONS

```bash
# Register a user (creates record in users table)
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farmer",
    "email": "test@agromind.test",
    "password": "password123",
    "phone": "9876543210",
    "location": "Kolhapur"
  }'

# Login (queries users table)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@agromind.test",
    "password": "password123",
    "location": "Kolhapur"
  }'

# Create farm (INSERT into farms table)
curl -X POST http://localhost:3001/api/v1/farms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Farm",
    "location": "Kolhapur",
    "total_area": 50
  }'

# Get all farms (SELECT from farms table)
curl -X GET http://localhost:3001/api/v1/farms \
  -H "Authorization: Bearer <token>"
```

---

## 🔍 VERIFY TABLE STRUCTURE

```bash
# Check users table
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT * FROM users;"

# Check farms table
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT * FROM farms;"

# Check scans table
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT * FROM scans;"

# Count all records
docker exec agromind-db psql -U agromind_user -d agromind_db -c "SELECT table_name, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## ⚙️ ENVIRONMENT VARIABLES

### Backend (.env or docker-compose.yml)
```
DATABASE_URL=postgresql://agromind_user:password123@postgres:5432/agromind_db
DB_HOST=postgres
DB_PORT=5432
DB_NAME=agromind_db
DB_USER=agromind_user
DB_PASSWORD=password123
DB_SSL=false
JWT_SECRET=your-secret-key-here
NODE_ENV=production
PORT=3001
```

### Docker Compose (Already Set)
```yaml
postgres:
  POSTGRES_DB: agromind_db
  POSTGRES_USER: agromind_user
  POSTGRES_PASSWORD: password123
  PGDATA: /var/lib/postgresql/data/pgdata
```

---

## 📝 SUMMARY

✅ **Database Connection**: PostgreSQL 16-Alpine running in Docker
✅ **Connection Pool**: Created via pg library in utils/database.ts
✅ **Authentication**: JWT-based, queries users table
✅ **Migrations**: Defined in migrations/run.ts
✅ **Tables**: 15+ tables created for users, farms, crops, scans, alerts, etc.
✅ **API Routes**: All endpoints connected to database
✅ **Background Jobs**: Running database queries on schedule
✅ **Frontend**: React app connects to backend API (not directly to DB)
✅ **Error Handling**: Database errors logged and handled
✅ **Transactions**: Transaction helper available for multi-query operations

**Everything is already configured and running! 🎉**

---

## 🆘 TROUBLESHOOTING

### Database Connection Error
```bash
# Check if PostgreSQL is running
docker exec agromind-db pg_isready -U agromind_user

# View logs
docker logs agromind-db
docker logs agromind-backend
```

### Tables Not Created
```bash
# Run migrations manually
docker exec agromind-backend npm run migrate

# Verify creation
docker exec agromind-db psql -U agromind_user -d agromind_db -c "\dt"
```

### Connection Timeout
```bash
# Check PostgreSQL is healthy
docker-compose ps postgres

# Restart database
docker-compose restart postgres
docker-compose restart backend
```

### Check Backend Logs
```bash
docker logs -f agromind-backend
```
