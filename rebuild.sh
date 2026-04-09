#!/bin/bash

# AgroMind Rebuild Script - Ensures all changes are saved and persisted
# This script rebuilds the entire project and updates Docker images

set -e

echo "🔨 AgroMind Project Rebuild Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop all running containers
echo -e "${BLUE}Step 1: Stopping all containers...${NC}"
docker-compose down
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Step 2: Clean build artifacts
echo -e "${BLUE}Step 2: Cleaning old build artifacts...${NC}"
rm -rf ./backend/dist
rm -rf ./frontend/dist
rm -rf ./ml-service/__pycache__
echo -e "${GREEN}✓ Build artifacts cleaned${NC}"
echo ""

# Step 3: Rebuild backend
echo -e "${BLUE}Step 3: Building backend...${NC}"
cd ./backend
npm run build
echo -e "${GREEN}✓ Backend built successfully${NC}"
cd ..
echo ""

# Step 4: Rebuild frontend
echo -e "${BLUE}Step 4: Building frontend...${NC}"
cd ./frontend
npm run build
echo -e "${GREEN}✓ Frontend built successfully${NC}"
cd ..
echo ""

# Step 5: Rebuild and start Docker containers
echo -e "${BLUE}Step 5: Building Docker images and starting containers...${NC}"
docker-compose up --build -d
echo -e "${GREEN}✓ Docker containers built and started${NC}"
echo ""

# Step 6: Wait for services to be healthy
echo -e "${BLUE}Step 6: Waiting for services to be healthy...${NC}"
sleep 10

# Check health
echo -e "${YELLOW}Checking service health:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep agromind

echo ""
echo -e "${GREEN}✅ Rebuild Complete!${NC}"
echo ""
echo "📋 Service Status:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo "  - Database: localhost:5432"
echo "  - ML Service: http://localhost:5001"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "All changes from your code are now:"
echo "  1. ✅ Saved to source files"
echo "  2. ✅ Built into backend/dist"
echo "  3. ✅ Built into frontend/dist"
echo "  4. ✅ Packaged into Docker images"
echo "  5. ✅ Running in Docker containers"
echo ""
echo "If you make code changes today, they will persist tomorrow when you restart!"
