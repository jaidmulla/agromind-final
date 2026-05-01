#!/bin/bash
# 🧠 AgroMind LeafAI Quick Test Script
# Test all major LeafAI endpoints

echo "════════════════════════════════════════════════════════════════"
echo "🧠 AgroMind LeafAI System — Functional Test Suite"
echo "════════════════════════════════════════════════════════════════"
echo ""

BASE_URL="http://localhost:5000"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1️⃣  Testing Service Health...${NC}"
curl -s "$BASE_URL/health" | jq '.'
echo ""

echo -e "${BLUE}2️⃣  Testing Root Endpoint...${NC}"
curl -s "$BASE_URL/" | jq '.'
echo ""

echo -e "${YELLOW}Note: Endpoints 3-7 require:${NC}"
echo "  - ML model loaded (models/plant_disease_model.h5)"
echo "  - Leaf images in data directory"
echo ""

echo -e "${BLUE}3️⃣  Leaf Identification (Replace with actual image)${NC}"
echo "curl -X POST \"$BASE_URL/leafai/identify\" -F \"image=@path/to/leaf.jpg\""
echo ""

echo -e "${BLUE}4️⃣  Knowledge Base Statistics${NC}"
curl -s "$BASE_URL/leafai/knowledge-base/stats" | jq '.' 2>/dev/null || \
  echo -e "${YELLOW}⚠️ LeafAI KB not yet initialized (add leaves first)${NC}"
echo ""

echo -e "${BLUE}5️⃣  List Available Diseases${NC}"
curl -s "$BASE_URL/diseases" | jq '.total' 
echo "diseases available in database"
echo ""

echo -e "${BLUE}6️⃣  Manual Leaf Registration${NC}"
echo "curl -X POST \"$BASE_URL/leafai/identify/manual\" \\"
echo "  -F \"image=@leaf.jpg\" \\"
echo "  -F \"common_name=Tomato\" \\"
echo "  -F \"scientific_name=Solanum lycopersicum\" \\"
echo "  -F \"family=Solanaceae\" \\"
echo "  -F \"health_status=Diseased\" \\"
echo "  -F \"confidence=95.0\""
echo ""

echo -e "${BLUE}7️⃣  Search Knowledge Base${NC}"
echo "curl -s \"$BASE_URL/leafai/knowledge-base/search?plant_name=Tomato\" | jq '.'"
echo ""

echo -e "${BLUE}8️⃣  Clustering Analysis${NC}"
echo "curl -s \"$BASE_URL/leafai/clustering?limit=10\" | jq '.'"
echo ""

echo -e "${BLUE}9️⃣  Anomaly Detection${NC}"
echo "curl -s \"$BASE_URL/leafai/anomalies\" | jq '.'"
echo ""

echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Test script complete!${NC}"
echo ""
echo "📚 Full documentation: See LEAFAI_DOCUMENTATION.md"
echo "🚀 Start ML service: python ml-service/main.py"
echo ""
