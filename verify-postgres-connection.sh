#!/bin/bash

# ================================================================================
# AGROMIND DATABASE CONNECTION VERIFICATION SCRIPT
# This script checks if PostgreSQL is properly connected to the project
# ================================================================================

echo "🔍 CHECKING AGROMIND POSTGRESQL CONNECTION..."
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# ================================================================================
# 1. Check if Docker is running
# ================================================================================
echo "1️⃣  Checking Docker..."
if docker ps > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker is running${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Docker is not running${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 2. Check if PostgreSQL container is running
# ================================================================================
echo "2️⃣  Checking PostgreSQL Container..."
if docker ps | grep -q "agromind-db"; then
    echo -e "${GREEN}✅ PostgreSQL container (agromind-db) is running${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    echo "    Start with: docker-compose up -d"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 3. Check PostgreSQL database connection
# ================================================================================
echo "3️⃣  Checking PostgreSQL Connection..."
if docker exec agromind-db pg_isready -U agromind_user -d agromind_db > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL database is accepting connections${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ PostgreSQL database is not accepting connections${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 4. Check if backend container is running
# ================================================================================
echo "4️⃣  Checking Backend Container..."
if docker ps | grep -q "agromind-backend"; then
    echo -e "${GREEN}✅ Backend container (agromind-backend) is running${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Backend container is not running${NC}"
    echo "    Start with: docker-compose up -d"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 5. Check if backend has database.ts file
# ================================================================================
echo "5️⃣  Checking Database Connection File..."
if [ -f "backend/src/utils/database.ts" ]; then
    echo -e "${GREEN}✅ Database connection file exists${NC}"
    echo "    Location: backend/src/utils/database.ts"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Database connection file not found${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 6. Check if migrations file exists
# ================================================================================
echo "6️⃣  Checking Migrations File..."
if [ -f "backend/src/migrations/run.ts" ]; then
    echo -e "${GREEN}✅ Migrations file exists${NC}"
    echo "    Location: backend/src/migrations/run.ts"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Migrations file not found${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 7. Check PostgreSQL version
# ================================================================================
echo "7️⃣  Checking PostgreSQL Version..."
PG_VERSION=$(docker exec agromind-db psql -U agromind_user -d agromind_db -t -c "SELECT version();" 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostgreSQL is responding${NC}"
    echo "    Version: $PG_VERSION"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 8. Check database tables
# ================================================================================
echo "8️⃣  Checking Database Tables..."
TABLES_COUNT=$(docker exec agromind-db psql -U agromind_user -d agromind_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1)
if [ "$TABLES_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Database tables exist${NC}"
    echo "    Total tables: $TABLES_COUNT"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  No tables found in database${NC}"
    echo "    Run migrations: docker exec agromind-backend npm run migrate"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 9. Check specific tables
# ================================================================================
echo "9️⃣  Checking Specific Tables..."
REQUIRED_TABLES=("users" "farms" "crops" "scans" "alerts")
TABLES_FOUND=0
TABLES_MISSING=0

for table in "${REQUIRED_TABLES[@]}"; do
    if docker exec agromind-db psql -U agromind_user -d agromind_db -t -c "\dt $table" 2>&1 | grep -q "$table"; then
        echo -e "${GREEN}✅ Table '$table' exists${NC}"
        ((TABLES_FOUND++))
    else
        echo -e "${RED}❌ Table '$table' not found${NC}"
        ((TABLES_MISSING++))
    fi
done

if [ $TABLES_MISSING -eq 0 ]; then
    ((CHECKS_PASSED++))
else
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 10. Check backend health endpoint
# ================================================================================
echo "🔟 Checking Backend Health Endpoint..."
HEALTH=$(curl -s http://localhost:3001/health | grep -o '"status":"ok"')
if [ ! -z "$HEALTH" ]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Backend not responding on /health${NC}"
    echo "    Make sure backend is started: docker-compose up -d"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# 11. Check database test endpoint
# ================================================================================
echo "1️⃣1️⃣ Checking Database Test Endpoint..."
DB_TEST=$(curl -s http://localhost:3001/test-db | grep -o '"success":true')
if [ ! -z "$DB_TEST" ]; then
    echo -e "${GREEN}✅ Database is connected to backend${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Database endpoint not responding${NC}"
    echo "    Check: curl http://localhost:3001/test-db"
    ((CHECKS_FAILED++))
fi
echo ""

# ================================================================================
# SUMMARY
# ================================================================================
echo "=================================================="
echo "📊 VERIFICATION SUMMARY"
echo "=================================================="
echo -e "Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "🚀 Your AgroMind project is fully connected to PostgreSQL!"
    echo ""
    echo "📍 Access Points:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend:  http://localhost:3001"
    echo "   - Database: postgresql://agromind_user:password123@localhost:5432/agromind_db"
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    echo "   1. Ensure Docker is running"
    echo "   2. Start all services: docker-compose up -d"
    echo "   3. Wait 30 seconds for PostgreSQL to be ready"
    echo "   4. Run migrations: docker exec agromind-backend npm run migrate"
    echo "   5. Re-run this script to verify"
    echo ""
    echo "📖 For more details, see POSTGRES_CONNECTION_SETUP.md"
    exit 1
fi
