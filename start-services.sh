#!/bin/bash
set -e

# Ensure Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
  echo "Starting Redis server..."
  redis-server --daemonize yes
fi

# Ensure MongoDB is running
if ! pgrep -x "mongod" > /dev/null 2>&1; then
  echo "Starting MongoDB server..."
  mkdir -p /data/db /var/log
  mongod --dbpath /data/db --bind_ip 127.0.0.1 --fork --logpath /var/log/mongodb.log
fi

# Ensure Go backend binary exists
if [ ! -f "./backend/polling-backend" ]; then
  echo "Building Go backend..."
  (cd backend && go build -o polling-backend main.go)
fi

# Ensure Go backend is running on port 8081
if ! curl -s http://127.0.0.1:8081/api/health > /dev/null 2>&1; then
  echo "Starting Go backend server on port 8081..."
  PORT=8081 MONGO_URI=mongodb://127.0.0.1:27017 REDIS_ADDR=127.0.0.1:6379 JWT_SECRET=super-secret-jwt-key-2026 nohup ./backend/polling-backend > /var/log/polling-backend.log 2>&1 &
  sleep 1
fi
