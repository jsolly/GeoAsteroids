#!/bin/bash

# Robust test runner script that prevents multiple Vitest instances
# This script ensures only one test process runs at a time

echo "🧪 Starting test runner with single-instance protection..."

RUNNER_STARTED_DEV=false

# Function to kill all test-related processes
kill_test_processes() {
    echo "🧹 Cleaning up existing test processes..."
    
    local vitest_pids=$(pgrep -f "vitest.*run" 2>/dev/null || true)
    if [ -n "$vitest_pids" ]; then
        local safe_pids=""
        for pid in $vitest_pids; do
            if ! ps -p $pid -o command= 2>/dev/null | grep -q "Cursor"; then
                safe_pids="$safe_pids $pid"
            fi
        done
        if [ -n "$safe_pids" ]; then
            echo "Found vitest test processes: $safe_pids"
            echo "$safe_pids" | xargs kill 2>/dev/null || true
        fi
    fi
    
    local node_test_pids=$(pgrep -f "node.*vitest.*run" 2>/dev/null || true)
    if [ -n "$node_test_pids" ]; then
        local safe_pids=""
        for pid in $node_test_pids; do
            if ! ps -p $pid -o command= 2>/dev/null | grep -q "Cursor"; then
                safe_pids="$safe_pids $pid"
            fi
        done
        if [ -n "$safe_pids" ]; then
            echo "Found node vitest processes: $safe_pids"
            echo "$safe_pids" | xargs kill 2>/dev/null || true
        fi
    fi
    
    sleep 2
    
    local remaining_vitest=$(pgrep -f "vitest.*run" 2>/dev/null || true)
    if [ -n "$remaining_vitest" ]; then
        local safe_pids=""
        for pid in $remaining_vitest; do
            if ! ps -p $pid -o command= 2>/dev/null | grep -q "Cursor"; then
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

cleanup_playwright_orphans() {
    local playwright_pids=$(pgrep -f "playwright.*run-driver|chromium.*headless.*GeoAsteroids-Test-Bot" 2>/dev/null || true)
    if [ -n "$playwright_pids" ]; then
        echo "🧹 Cleaning orphaned Playwright/Chromium test processes..."
        echo "$playwright_pids" | xargs kill 2>/dev/null || true
    fi
}

check_test_processes() {
    local running_test_processes=$(pgrep -f "vitest.*run" | wc -l)
    if [ $running_test_processes -gt 0 ]; then
        echo "❌ Found $running_test_processes vitest test process(es) still running:"
        pgrep -f "vitest.*run" | xargs ps -p
        return 1
    fi
    return 0
}

servers_ready() {
    curl -sf http://localhost:5173/ > /dev/null 2>&1 && curl -sf http://localhost:3001/health > /dev/null 2>&1
}

wait_for_servers() {
    local retries=0
    while [ $retries -lt 20 ]; do
        if servers_ready; then
            echo "✅ Dev servers are running"
            return 0
        fi
        retries=$((retries + 1))
        echo "⏳ Waiting for servers... (attempt $retries/20)"
        sleep 2
    done
    return 1
}

servers_have_world_diagnostics() {
    curl -sf http://localhost:3001/health | grep -q '"world"'
}

start_dev_servers() {
    echo "🔍 Checking if dev servers are running..."
    
    if servers_ready && servers_have_world_diagnostics; then
        echo "✅ Dev servers are already running"
        return 0
    fi

    if servers_ready && ! servers_have_world_diagnostics; then
        echo "♻️  Dev server is running an older build — restarting for test diagnostics..."
        npm run dev:kill >/dev/null 2>&1 || true
        sleep 2
    fi

    if curl -sf http://localhost:5173/ > /dev/null 2>&1 || curl -sf http://localhost:3001/health > /dev/null 2>&1; then
        echo "⏳ Partial server startup detected — waiting for both endpoints..."
        if wait_for_servers; then
            return 0
        fi
        echo "❌ Servers did not become ready after partial startup"
        exit 1
    fi

    echo "🚀 Starting dev servers..."
    ./scripts/dev-server.sh &
    RUNNER_STARTED_DEV=true

    if ! wait_for_servers; then
        echo "❌ Failed to start dev servers"
        exit 1
    fi
}

run_tests() {
    local test_args="$@"
    local vitest_config="vitest.config.ts"

    if echo "$test_args" | grep -q "tests/integration/browser"; then
        vitest_config="vitest.browser.config.ts"
    fi
    
    echo "🧪 Running tests with single-instance protection..."
    echo "📝 Test arguments: $test_args"
    echo "📝 Vitest config: $vitest_config"
    
    npx --no-install vitest run \
        --config "$vitest_config" \
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

main() {
    local test_args="$@"
    
    kill_test_processes
    cleanup_playwright_orphans
    
    if ! check_test_processes; then
        echo "❌ Failed to clean up existing test processes"
        exit 1
    fi
    
    start_dev_servers
    
    run_tests $test_args
    local exit_code=$?
    
    echo "🧹 Cleaning up after tests..."
    kill_test_processes
    cleanup_playwright_orphans
    
    if [ "$RUNNER_STARTED_DEV" = "true" ]; then
        echo "ℹ️  Dev servers were started by the test runner and left running"
    fi
    
    exit $exit_code
}

main "$@"
