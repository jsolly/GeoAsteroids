#!/bin/bash

# Respawn Test Runner
# Tests the respawn functionality by running the WebSocket test

set -e

echo "🧪 Running Respawn Functionality Tests..."
echo "========================================"

# Check if server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Server is not running on port 3001"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running"

# Run the WebSocket respawn test
echo "🔌 Running WebSocket respawn test..."
npx tsx scripts/test-respawn-websocket.ts

echo ""
echo "🎉 Respawn tests completed!"
