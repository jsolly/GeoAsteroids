# Roid Tests

This folder contains browser integration tests for roid (asteroid) functionality.

## Test Files

- **two-players-hit-big-roid-within-one-second-splits.test.ts** - Two players hit a biggest asteroid within 1s → split
- **large-roids-split-into-medium-roids.test.ts** - Solo finish of a large roid does not split
- **medium-roids-split-into-small-roids.test.ts** - Medium class never splits
- **small-roids-do-not-split.test.ts** - Solo large destroy reduces the field (no fragments)

## Test Coverage

- Collaborative split for the biggest asteroids
- Solo destroy does not split
- Collision-based roid destruction
- Smaller roid classes never split

## Dependencies

These tests use the browser test infrastructure:

- BrowserManager for browser automation
- GameInteractions for game control
