#!/bin/bash

# Clean test runner script
# This script ensures no existing test processes are running before starting new tests

echo "🧹 Cleaning up existing test processes..."

# Kill only vitest test processes, not Cursor processes
pkill -f "vitest.*run" 2>/dev/null || true
pkill -f "node.*vitest.*run" 2>/dev/null || true
pkill -f "npm.*test.*run" 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 2

# Check if any vitest test processes are still running
if pgrep -f "vitest.*run" > /dev/null; then
    echo "⚠️  Some vitest test processes are still running, force killing..."
    pkill -9 -f "vitest.*run" 2>/dev/null || true
    sleep 1
fi

# Kill any background dev servers
pkill -f "npm run dev" 2>/dev/null || true

echo "✅ Cleanup complete"

# Start dev servers
echo "🚀 Starting development servers..."
npm run dev &
DEV_PID=$!

# Wait for servers to start
echo "⏳ Waiting for servers to start..."
sleep 5

# Check if servers are running
if ! curl -s http://localhost:3001 > /dev/null; then
    echo "❌ WebSocket server not responding"
    exit 1
fi

if ! curl -s http://localhost:5173 > /dev/null; then
    echo "❌ Vite dev server not responding"
    exit 1
fi

echo "✅ Servers are running"

# Run the test command passed as arguments
echo "🧪 Running tests: $@"
exec "$@"

# Cleanup on exit
trap "echo '🧹 Cleaning up...'; kill $DEV_PID 2>/dev/null || true; pkill -f 'vitest' 2>/dev/null || true" EXIT
