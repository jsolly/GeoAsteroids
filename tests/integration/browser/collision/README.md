# Collision Tests

This folder contains browser integration tests for collision detection and handling.

## Test Files

- **botAsteroidCollisions.test.ts** - Tests bot collision with asteroids, including damage application and bot destruction
- **laserCollisions.test.ts** - Tests laser collision with asteroids, including asteroid destruction and splitting

## Test Coverage

- Bot-asteroid collision damage
- Bot destruction on collision
- Laser-asteroid collision detection
- Asteroid destruction from laser hits
- Collision-based asteroid splitting
- Network communication for collision events

## Dependencies

These tests use the browser test infrastructure:
- BrowserManager for browser automation
- ScreenshotManager for test documentation
- GameInteractions for game control
- HealthChecker for server health validation
