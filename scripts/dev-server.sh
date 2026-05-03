#!/bin/bash

# Robust dev server management script
# This script ensures only one dev server instance runs at a time

echo "🧹 Cleaning up existing dev servers..."

# Kill only our specific dev server processes, not system processes
# Be more specific to avoid killing Cursor or other system processes
pkill -f 'tsx.*server\.ts' 2>/dev/null || true
pkill -f 'vite.*--mode.*development' 2>/dev/null || true
pkill -f 'concurrently.*vite.*tsx' 2>/dev/null || true
pkill -f 'npm run dev' 2>/dev/null || true

# Wait for processes to terminate
sleep 3

# Check if any of our specific processes are still running
if pgrep -f 'tsx.*server\.ts' > /dev/null || pgrep -f 'vite.*--mode.*development' > /dev/null || pgrep -f 'concurrently.*vite.*tsx' > /dev/null; then
    echo "⚠️  Some dev server processes are still running, force killing..."
    pkill -9 -f 'tsx.*server\.ts' 2>/dev/null || true
    pkill -9 -f 'vite.*--mode.*development' 2>/dev/null || true
    pkill -9 -f 'concurrently.*vite.*tsx' 2>/dev/null || true
    sleep 2
fi

# Force kill any processes using our ports
echo "🔫 Force killing processes using ports 3001 and 5173..."
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true

# Wait for ports to be freed
sleep 2

# Verify ports are free
if lsof -i :3001 > /dev/null 2>&1; then
    echo "❌ Port 3001 is still in use after force kill"
    lsof -i :3001
    exit 1
fi

if lsof -i :5173 > /dev/null 2>&1; then
    echo "❌ Port 5173 is still in use after force kill"
    lsof -i :5173
    exit 1
fi

echo "✅ Cleanup complete, starting dev servers..."

# Create logs directory
mkdir -p logs
rm -f logs/client.log logs/server.log
touch logs/client.log logs/server.log

# Start the dev servers
# Set test environment variables to disable rate limiting during development
export NODE_ENV=development
export VITEST=false

exec npx concurrently \
  --kill-others \
  --prefix-colors "blue.bold,green.bold" \
  --prefix "[{name}]" \
  --names "vite,network" \
  "vite" \
  "tsx --env-file=.env server.ts"
