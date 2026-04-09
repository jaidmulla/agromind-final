#!/bin/bash

# AgroMind Quick Commands Reference
# Copy this file as "run.sh" in your project root for easy access

PROJ_DIR="/Users/jaid/Documents/Hackethone/DYP Kolhapur/agromind-final"

show_help() {
  cat << 'EOF'
🌱 AgroMind AI Doctor - Command Reference

STARTUP COMMANDS:
  ./run.sh start       - Start all services in background
  ./run.sh stop        - Stop all services
  ./run.sh restart     - Restart all services
  ./run.sh rebuild     - Full rebuild (after code changes)
  ./run.sh status      - Show service status
  ./run.sh verify      - Verify all systems healthy

LOGS & DEBUG:
  ./run.sh logs        - Show all service logs (live)
  ./run.sh backend     - Show backend logs only
  ./run.sh frontend    - Show frontend logs only
  ./run.sh db          - Show database logs only
  ./run.sh ml          - Show ML service logs only

DATABASE:
  ./run.sh db-shell    - Connect to PostgreSQL shell
  ./run.sh db-backup   - Backup database
  ./run.sh db-restore  - Restore from backup

DEVELOPMENT:
  ./run.sh build       - Build without starting
  ./run.sh clean       - Remove containers & volumes
  ./run.sh help        - Show this help message

EXAMPLES:
  # Restart backend after code changes
  ./run.sh rebuild

  # Watch backend logs while testing
  ./run.sh backend

  # Check why a service isn't working
  ./run.sh logs

  # Stop everything before shutdown
  ./run.sh stop
EOF
}

case "${1:-help}" in
  start)
    echo "🚀 Starting AgroMind services..."
    cd "$PROJ_DIR" && docker-compose up -d
    sleep 5
    ./verify-system.sh
    ;;
  stop)
    echo "⏹️  Stopping AgroMind services..."
    cd "$PROJ_DIR" && docker-compose down
    echo "✅ All services stopped"
    ;;
  restart)
    echo "🔄 Restarting AgroMind services..."
    cd "$PROJ_DIR" && docker-compose restart
    echo "✅ All services restarted"
    ;;
  rebuild)
    echo "🔨 Rebuilding AgroMind (full clean rebuild)..."
    cd "$PROJ_DIR" && ./rebuild.sh
    ;;
  status|ps)
    cd "$PROJ_DIR" && docker-compose ps
    ;;
  verify)
    cd "$PROJ_DIR" && ./verify-system.sh
    ;;
  logs)
    echo "📋 Showing all service logs (Ctrl+C to stop)..."
    cd "$PROJ_DIR" && docker-compose logs -f
    ;;
  backend)
    echo "📋 Backend logs (Ctrl+C to stop)..."
    cd "$PROJ_DIR" && docker-compose logs -f backend
    ;;
  frontend)
    echo "📋 Frontend logs (Ctrl+C to stop)..."
    cd "$PROJ_DIR" && docker-compose logs -f frontend
    ;;
  db)
    echo "📋 Database logs (Ctrl+C to stop)..."
    cd "$PROJ_DIR" && docker-compose logs -f postgres
    ;;
  ml)
    echo "📋 ML Service logs (Ctrl+C to stop)..."
    cd "$PROJ_DIR" && docker-compose logs -f ml-service
    ;;
  db-shell)
    echo "🔓 Connecting to PostgreSQL..."
    cd "$PROJ_DIR" && docker-compose exec postgres psql -U agromind_user -d agromind_db
    ;;
  db-backup)
    echo "💾 Backing up database..."
    cd "$PROJ_DIR"
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    docker-compose exec -T postgres pg_dump -U agromind_user -d agromind_db > "$BACKUP_FILE"
    echo "✅ Database backed up to: $BACKUP_FILE"
    ;;
  db-restore)
    if [ -z "$2" ]; then
      echo "❌ Usage: ./run.sh db-restore <backup_file>"
      echo "Example: ./run.sh db-restore backup_20260409_120000.sql"
      exit 1
    fi
    echo "⚠️  Restoring database from: $2"
    cd "$PROJ_DIR"
    cat "$2" | docker-compose exec -T postgres psql -U agromind_user -d agromind_db
    echo "✅ Database restored"
    ;;
  build)
    echo "🔨 Building services (without starting)..."
    cd "$PROJ_DIR" && docker-compose build
    ;;
  clean)
    echo "🧹 Cleaning up (removing containers & volumes)..."
    cd "$PROJ_DIR" && docker-compose down -v
    echo "✅ Cleanup complete. Run './run.sh start' to restart fresh"
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo "❌ Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac
