#!/bin/bash

# AgroMind System Verification Script
# Checks all services and verifies the AI Doctor Chat system is working

echo "🔍 AgroMind Service Verification"
echo "================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
  local name=$1
  local port=$2
  local path=${3:-/}
  
  if curl -s "http://localhost:$port$path" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} $name (port $port) - RUNNING"
    return 0
  else
    echo -e "${RED}❌${NC} $name (port $port) - FAILED"
    return 1
  fi
}

check_docker() {
  local container=$1
  if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
    echo -e "${GREEN}✅${NC} Container $container - UP"
    return 0
  else
    echo -e "${RED}❌${NC} Container $container - DOWN"
    return 1
  fi
}

# Check Docker containers
echo "📦 Docker Containers:"
check_docker "agromind-backend"
check_docker "agromind-frontend"
check_docker "agromind-db"
check_docker "agromind-ml"
check_docker "agromind-nginx"
echo ""

# Check services
echo "🌐 Services:"
check_service "Backend API" 3001 "/health"
check_service "Frontend" 3000
check_service "ML Service" 5001 "/health"
echo ""

# Check database
echo "🗄️  Database:"
if docker exec -i agromind-db psql -U agromind_user -d agromind_db -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC} PostgreSQL - CONNECTED"
  
  # Check chat_history table
  if docker exec -i agromind-db psql -U agromind_user -d agromind_db -c "SELECT COUNT(*) FROM chat_history;" > /dev/null 2>&1; then
    CHAT_COUNT=$(docker exec -i agromind-db psql -U agromind_user -d agromind_db -t -c "SELECT COUNT(*) FROM chat_history;" 2>/dev/null | tr -d ' ')
    echo -e "${GREEN}✅${NC} Chat History Table - EXISTS ($CHAT_COUNT records)"
  else
    echo -e "${RED}❌${NC} Chat History Table - NOT FOUND"
  fi
else
  echo -e "${RED}❌${NC} PostgreSQL - CONNECTION FAILED"
fi
echo ""

# Check backend logs for errors
echo "📋 Backend Status:"
if docker logs agromind-backend 2>&1 | grep -q "running on port"; then
  echo -e "${GREEN}✅${NC} Backend started successfully"
else
  echo -e "${YELLOW}⚠️${NC}  Backend may still be starting"
fi

# Summary
echo ""
echo "================================="
echo "✅ System Check Complete!"
echo ""
echo "📍 Access Points:"
echo "   Frontend:   http://localhost:3000"
echo "   Backend:    http://localhost:3001/api/v1"
echo "   Health:     http://localhost:3001/health"
echo ""
echo "💬 Chat API:"
echo "   POST /api/v1/chat (requires auth)"
echo "   GET /api/v1/chat/history (requires auth)"
echo ""
echo "🔧 Next Steps:"
echo "   1. Open http://localhost:3000 in browser"
echo "   2. Sign up or login with existing account"
echo "   3. Go to 'AI Doctor' section"
echo "   4. Select language (English, Hindi, Marathi)"
echo "   5. Ask a question about your crops"
echo ""
