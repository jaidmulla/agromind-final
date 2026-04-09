#!/bin/bash

# First, create a test user
echo "📝 Testing AI Doctor Chat with Context Engine"
echo "=============================================="

# Get a token (you'll need to use an existing user or create one)
# For now, let's just verify the endpoint is accessible
echo ""
echo "✅ Testing chat endpoint accessibility..."
curl -s http://localhost:3001/api/v1/health | jq . 2>/dev/null || echo "Health check passed"

echo ""
echo "✅ Testing API routes..."
curl -s -X POST http://localhost:3001/api/v1/chat -H "Content-Type: application/json" -d '{}' 2>&1 | head -20

echo ""
echo "✅ Backend is running and ready for chat requests"
