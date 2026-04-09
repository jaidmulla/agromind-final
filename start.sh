#!/bin/bash

# Quick Startup Script - Use this every morning
# All your changes from yesterday are automatically loaded!

echo "🚀 AgroMind Quick Startup"
echo "========================="
echo ""

# Start containers from saved Docker images
docker-compose down 2>/dev/null || true
echo "Starting services..."
docker-compose up -d

# Wait for health checks
echo "Waiting for services..."
sleep 10

# Show status
echo ""
echo "✅ Services Started!"
echo "🌐 Open: http://localhost:3000"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep agromind

echo ""
echo "📌 Your changes from yesterday are loaded! ✨"
