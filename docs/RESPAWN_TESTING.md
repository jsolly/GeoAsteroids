# Respawn Testing

This document describes the respawn testing functionality that was implemented to verify the fix for the respawn bug.

## Overview

The respawn system ensures that players who die are properly respawned with full health (100/100) after a 3-second delay. The testing suite validates this functionality through multiple approaches.

## Test Components

### 1. Selenium Probe Integration (`scripts/selenium-probe.ts`)

The existing selenium probe has been enhanced with respawn testing:

- **Function**: `testRespawnFunctionality()`
- **What it does**: 
  - Simulates player death via browser console
  - Checks if respawn timer is set correctly
  - Validates respawn state transitions
- **Usage**: `npx tsx scripts/selenium-probe.ts`

### 2. WebSocket Test (`scripts/test-respawn-websocket.ts`)

A standalone WebSocket client that tests the server-side respawn system:

- **Class**: `RespawnTester`
- **What it does**:
  - Connects to the multiplayer server
  - Joins as a test player
  - Simulates player death via damage
  - Monitors the complete respawn process
  - Validates final respawn state
- **Usage**: `npm run test:respawn:ws`

### 3. Unit Tests (`test/respawn.test.ts`)

Vitest-based unit tests for respawn functionality:

- **Integration test**: Tests the complete respawn flow
- **Unit tests**: Validates respawn timer logic and state transitions
- **Usage**: `npm test` (runs all tests including respawn)

### 4. Shell Script (`scripts/test-respawn.sh`)

A convenient wrapper script that:

- Checks if the server is running
- Runs the WebSocket respawn test
- Provides clear output formatting
- **Usage**: `npm run test:respawn`

## Test Scenarios

### Player Death and Respawn Flow

1. **Initial State**: Player has 100/100 health, not exploding, no respawn timer
2. **Death**: Player takes 100 damage → health = 0, exploding = true
3. **Respawn Timer**: Server sets respawnTimer = 180 (3 seconds at 60 FPS)
4. **Countdown**: Timer decrements each frame until reaching 0
5. **Respawn**: Player respawns with:
   - Health = 100
   - Exploding = false
   - RespawnTimer = undefined
   - New random position
   - Reset velocity and rotation

### Validation Checks

The tests verify:

- ✅ Player death is detected correctly
- ✅ Respawn timer is set with correct value (180 frames)
- ✅ Timer countdown works properly
- ✅ Player respawns with full health
- ✅ Exploding state is cleared
- ✅ Respawn timer is cleared after respawn
- ✅ Player gets a new position
- ✅ All state transitions are correct

## Running Tests

### Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Ensure the server is running on port 3001

### Test Commands

```bash
# Run WebSocket respawn test directly
npm run test:respawn:ws

# Run with server health check
npm run test:respawn

# Run selenium probe (includes respawn testing)
npx tsx scripts/selenium-probe.ts

# Run all tests including respawn unit tests
npm test
```

## Expected Output

Successful test run should show:

```
🧪 Starting respawn functionality tests...
✅ Connected to server
✅ Player joined successfully
🧪 Testing player death...
✅ Player died successfully
🧪 Monitoring respawn process...
✅ Respawn timer set: 180
✅ Player respawned successfully
🧪 Validating respawn results...

📊 Respawn Test Results:
========================
✅ Test 1: Player death detected
✅ Test 2: Respawn timer set correctly
✅ Test 3: Player respawn completed
✅ Test 4: Health restored
✅ Test 5: Exploding state cleared
✅ Test 6: Respawn timer cleared
✅ Test 7: Position changed

📈 Summary: 7/7 tests passed
🎉 All respawn tests passed!
```

## Troubleshooting

### Common Issues

1. **Server not running**: Start with `npm run dev`
2. **Port conflicts**: Ensure port 3001 is available
3. **WebSocket connection failed**: Check server logs for errors
4. **Test timeouts**: Increase timeout values if needed

### Debug Mode

For detailed debugging, check the server logs:
```bash
tail -f logs/server.log
```

The server logs will show respawn-related messages:
- `✅ Player destroyed! Setting respawn timer for [player-id]`
- Respawn timer countdown
- Player respawn events

## Implementation Details

### Server-Side Changes

- `PlayerManager.ts`: Added respawn timer handling
- `GameEngine.ts`: Added respawn timer setting in damage handling
- `MessageHandler.ts`: Enhanced damage processing

### Client-Side Changes

- `PlayerSyncManager.ts`: Added respawn timer synchronization
- `canvas.ts`: Simplified rendering logic for respawning players

### Key Constants

- **Respawn Delay**: 180 frames (3 seconds at 60 FPS)
- **Max Health**: 100
- **Death Health**: 0
- **Explosion Duration**: Matches respawn delay

This testing suite ensures the respawn system works correctly and provides confidence that the original bug (players respawning with 0/100 health) has been resolved.
