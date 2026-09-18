#!/bin/bash

# Export bin path so mongod and redis-server are always available
export PATH="$(pwd)/bin:/usr/local/bin:/usr/bin:$PATH"

mkdir -p ./data/db /data/db /var/log
chmod +x ./bin/* ./backend/polling-backend 2>/dev/null || true

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
elif [ -f backend/.env ]; then
  set -a
  source backend/.env 2>/dev/null || true
  set +a
fi

BACKEND_PORT="${BACKEND_PORT:-8081}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
MONGO_DB_NAME="${MONGO_DB_NAME:-live_polling_db}"
REDIS_ADDR="${REDIS_ADDR:-127.0.0.1:6379}"
REDIS_PASS="${REDIS_PASS:-}"
JWT_SECRET="${JWT_SECRET:-super-secret-jwt-key-2026}"

# 1. Start Redis if not running and REDIS_ADDR points to localhost/127.0.0.1
if [[ "$REDIS_ADDR" == *"127.0.0.1"* ]] || [[ "$REDIS_ADDR" == *"localhost"* ]]; then
  if ! redis-cli ping > /dev/null 2>&1; then
    echo "Starting Redis server..."
    redis-server --daemonize yes 2>/dev/null || ./bin/redis-server --daemonize yes 2>/dev/null || true
    sleep 0.5
  fi
fi

# 2. Start MongoDB if MONGO_URI points to localhost/127.0.0.1 and not already running
if [[ "$MONGO_URI" == *"127.0.0.1"* ]] || [[ "$MONGO_URI" == *"localhost"* ]]; then
  if ! pgrep -x "mongod" > /dev/null 2>&1; then
    echo "Starting local MongoDB server..."
    rm -f ./data/db/mongod.lock /tmp/mongodb-27017.sock 2>/dev/null || true
    nohup mongod --dbpath ./data/db --bind_ip 127.0.0.1 --wiredTigerCacheSizeGB 0.25 --syncdelay 60 > /var/log/mongodb.log 2>&1 &
    sleep 1.5
  fi
else
  echo "Using remote/Atlas MongoDB: ${MONGO_URI%@*}... (credentials masked)"
fi

# 3. Start Go backend if not running or if health endpoint indicates failure
HEALTH_STATUS=$(curl -s "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null || true)
if [[ ! "$HEALTH_STATUS" =~ "healthy" ]] && [[ ! "$HEALTH_STATUS" =~ "Go with Gin" ]]; then
  echo "Starting Go backend on port $BACKEND_PORT..."
  pkill -f "polling-backend" 2>/dev/null || true
  sleep 0.3
  nohup env PORT="$BACKEND_PORT" MONGO_URI="$MONGO_URI" MONGO_DB_NAME="$MONGO_DB_NAME" REDIS_ADDR="$REDIS_ADDR" REDIS_PASS="$REDIS_PASS" JWT_SECRET="$JWT_SECRET" ./backend/polling-backend > /var/log/polling-backend.log 2>&1 &
  sleep 1.5
fi

