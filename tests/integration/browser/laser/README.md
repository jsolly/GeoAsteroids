# Laser Tests

This folder contains browser integration tests for laser functionality and network communication.

## Test Files

- **laserCommunication.test.ts** - Tests laser firing and network communication between client and server
- **laserNetworkFlow.test.ts** - Tests the complete network flow for laser events
- **laserServerLogs.test.ts** - Tests server-side logging for laser events

## Test Coverage

- Laser firing mechanics
- Client-server laser communication
- Network message flow for laser events
- Server-side laser event logging
- Laser state synchronization
- Error handling for laser network issues

## Dependencies

These tests use the browser test infrastructure:
- BrowserManager for browser automation
- ScreenshotManager for test documentation
- GameInteractions for game control
- HealthChecker for server health validation
