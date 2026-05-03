#!/bin/bash

# Robust test runner script that prevents multiple Vitest instances
# This script ensures only one test process runs at a time

echo "🧪 Starting test runner with single-instance protection..."

# Function to kill all test-related processes
kill_test_processes() {
    echo "🧹 Cleaning up existing test processes..."
    
    # Safety check: Don't kill processes if Cursor is running
    if pgrep -f "Cursor" > /dev/null; then
        echo "⚠️  Cursor is running - using conservative cleanup"
    fi
    
    # Only kill vitest processes that are actually running tests, not Cursor processes
    # Look for vitest processes that are running test files specifically
    local vitest_pids=$(pgrep -f "vitest.*run" 2>/dev/null || true)
    if [ -n "$vitest_pids" ]; then
        # Double-check these aren't Cursor processes
        local safe_pids=""
        for pid in $vitest_pids; do
            if ! ps -p $pid -o command= | grep -q "Cursor"; then
                safe_pids="$safe_pids $pid"
            fi
        done
        if [ -n "$safe_pids" ]; then
            echo "Found vitest test processes: $safe_pids"
            echo "$safe_pids" | xargs kill 2>/dev/null || true
        fi
    fi
    
    # Kill node test processes but be more specific
    local node_test_pids=$(pgrep -f "node.*vitest.*run" 2>/dev/null || true)
    if [ -n "$node_test_pids" ]; then
        # Double-check these aren't Cursor processes
        local safe_pids=""
        for pid in $node_test_pids; do
            if ! ps -p $pid -o command= | grep -q "Cursor"; then
                safe_pids="$safe_pids $pid"
            fi
        done
        if [ -n "$safe_pids" ]; then
            echo "Found node vitest processes: $safe_pids"
            echo "$safe_pids" | xargs kill 2>/dev/null || true
        fi
    fi
    
    # Wait for processes to terminate
    sleep 2
    
    # Only force kill if we can confirm they're test processes and not Cursor
    local remaining_vitest=$(pgrep -f "vitest.*run" 2>/dev/null || true)
    if [ -n "$remaining_vitest" ]; then
        local safe_pids=""
        for pid in $remaining_vitest; do
            if ! ps -p $pid -o command= | grep -q "Cursor"; then
                safe_pids="$safe_pids $pid"
            fi
        done
        if [ -n "$safe_pids" ]; then
            echo "⚠️  Force killing remaining vitest test processes..."
            echo "$safe_pids" | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    fi
    
    echo "✅ Test process cleanup complete"
}

# Function to check if any test processes are running
check_test_processes() {
    local running_test_processes=$(pgrep -f "vitest.*run" | wc -l)
    if [ $running_test_processes -gt 0 ]; then
        echo "❌ Found $running_test_processes vitest test process(es) still running:"
        pgrep -f "vitest.*run" | xargs ps -p
        return 1
    fi
    return 0
}

# Function to start dev servers if needed
start_dev_servers() {
    echo "🔍 Checking if dev servers are running..."
    
    # Check if servers are running
    local vite_running=$(curl -s http://localhost:5173 > /dev/null 2>&1 && echo "true" || echo "false")
    local server_running=$(curl -s http://localhost:3001/health > /dev/null 2>&1 && echo "true" || echo "false")
    
    if [ "$vite_running" = "false" ] || [ "$server_running" = "false" ]; then
        echo "🚀 Starting dev servers..."
        ./scripts/dev-server.sh &
        DEV_PID=$!
        
        # Wait for servers to start
        echo "⏳ Waiting for servers to start..."
        sleep 5
        
        # Verify servers are running
        local retries=0
        while [ $retries -lt 10 ]; do
            vite_running=$(curl -s http://localhost:5173 > /dev/null 2>&1 && echo "true" || echo "false")
            server_running=$(curl -s http://localhost:3001/health > /dev/null 2>&1 && echo "true" || echo "false")
            
            if [ "$vite_running" = "true" ] && [ "$server_running" = "true" ]; then
                echo "✅ Dev servers are running"
                break
            fi
            
            retries=$((retries + 1))
            echo "⏳ Waiting for servers... (attempt $retries/10)"
            sleep 2
        done
        
        if [ "$vite_running" = "false" ] || [ "$server_running" = "false" ]; then
            echo "❌ Failed to start dev servers"
            exit 1
        fi
    else
        echo "✅ Dev servers are already running"
    fi
}

# Function to run tests with single-instance protection
run_tests() {
    local test_args="$@"
    
    echo "🧪 Running tests with single-instance protection..."
    echo "📝 Test arguments: $test_args"
    
    # Run vitest with explicit single-instance flags
    npx vitest run \
        --pool=forks \
        --poolOptions.forks.singleFork=true \
        --sequence.concurrent=false \
        --maxConcurrency=1 \
        --isolate=true \
        --fileParallelism=false \
        $test_args
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ Tests completed successfully"
    else
        echo "❌ Tests failed with exit code $exit_code"
    fi
    
    return $exit_code
}

# Main execution
main() {
    # Parse command line arguments
    local test_args="$@"
    
    # Always clean up first
    kill_test_processes
    
    # Verify cleanup
    if ! check_test_processes; then
        echo "❌ Failed to clean up existing test processes"
        exit 1
    fi
    
    # Start dev servers if needed
    start_dev_servers
    
    # Run tests
    run_tests $test_args
    local exit_code=$?
    
    # Clean up after tests
    echo "🧹 Cleaning up after tests..."
    kill_test_processes
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"
