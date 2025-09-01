#!/bin/bash

# Respawn Test Runner
# Tests the respawn functionality by running the WebSocket test

set -e

# Resolve script directory for robust path handling
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧪 Running Respawn Functionality Tests..."
echo "========================================"

# Check if server is running
if ! curl -s --connect-timeout 5 --max-time 10 --fail http://localhost:3001/health > /dev/null; then
    echo "❌ Server is not running on port 3001"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running"

# Run the WebSocket respawn test
echo "🔌 Running WebSocket respawn test..."

# Execute the test in a way that's exempt from errexit
if npx tsx "$SCRIPT_DIR/test-respawn-websocket.ts"; then
    test_exit_code=0
else
    test_exit_code=$?
fi

echo ""
if [ $test_exit_code -eq 0 ]; then
    echo "🎉 Respawn tests completed successfully!"
else
    echo "💥 Respawn tests failed with exit code $test_exit_code"
fi

exit $test_exit_code
