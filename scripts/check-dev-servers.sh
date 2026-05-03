#!/bin/bash

# Check if dev servers are running
echo "🔍 Checking for running dev servers..."

# Check for tsx server processes
tsx_processes=$(pgrep -f 'tsx.*server.ts' | wc -l)
if [ $tsx_processes -gt 0 ]; then
    echo "⚠️  Found $tsx_processes tsx server process(es):"
    pgrep -f 'tsx.*server.ts' | xargs ps -p
fi

# Check for vite processes
vite_processes=$(pgrep -f 'vite' | wc -l)
if [ $vite_processes -gt 0 ]; then
    echo "⚠️  Found $vite_processes vite process(es):"
    pgrep -f 'vite' | xargs ps -p
fi

# Check for concurrently processes
concurrently_processes=$(pgrep -f 'concurrently' | wc -l)
if [ $concurrently_processes -gt 0 ]; then
    echo "⚠️  Found $concurrently_processes concurrently process(es):"
    pgrep -f 'concurrently' | xargs ps -p
fi

# Check port usage
echo "🔌 Checking port usage:"
if lsof -i :3001 > /dev/null 2>&1; then
    echo "❌ Port 3001 is in use:"
    lsof -i :3001
else
    echo "✅ Port 3001 is free"
fi

if lsof -i :5173 > /dev/null 2>&1; then
    echo "❌ Port 5173 is in use:"
    lsof -i :5173
else
    echo "✅ Port 5173 is free"
fi

# Summary
total_processes=$((tsx_processes + vite_processes + concurrently_processes))
if [ $total_processes -eq 0 ]; then
    echo "✅ No dev server processes running"
else
    echo "⚠️  Total dev server processes: $total_processes"
fi
