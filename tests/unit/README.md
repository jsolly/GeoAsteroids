# Unit Tests - Organized by Functionality

This directory contains unit tests organized by functionality rather than by file structure. This organization makes it easier to find and maintain tests related to specific aspects of the game.

## Directory Structure

### `/entities/`

Tests for game entities and their core functionality:

- **asteroidPoints.test.ts** - Tests asteroid point calculation logic
- **asteroids.test.ts** - Tests asteroid creation and basic functionality
- **asteroidSplitting.test.ts** - Tests asteroid splitting mechanics
- **botAsteroidCollisions.test.ts** - Tests bot collision with asteroids
- **localPlayerRoidCollision.test.ts** - Tests local player collision with asteroids
- **shipDamage.test.ts** - Tests ship damage system
- **shipDamageRespawn.test.ts** - Tests ship damage and respawn mechanics
- **Sound.test.ts** - Tests sound system functionality

### `/systems/`

Tests for game systems and mechanics:

- **boundary.test.ts** - Tests boundary collision system
- **collisions.test.ts** - Tests collision detection system
- **deathMessage.test.ts** - Tests death message system
- **gameOver.test.ts** - Tests game over system
- **laserCollisionDetection.test.ts** - Tests laser collision detection
- **laserCollisions.test.ts** - Tests laser collision system
- **minimap.test.ts** - Tests minimap system
- **respawn.test.ts** - Tests respawn system
- **scoring.test.ts** - Tests scoring system

### `/server/`

Tests for server-side functionality:

- **env-vars.test.ts** - Tests environment variable handling
- **remote-player-damage.test.ts** - Tests remote player damage system
- **remote-player-respawn.test.ts** - Tests remote player respawn system
- **server-scoring.test.ts** - Tests server-side scoring system

### `/utils/`

Tests for utility functions and configuration:

- **config.test.ts** - Tests configuration system
- **main.test.ts** - Tests main application functionality
- **utils.test.ts** - Tests utility functions

## Benefits of This Organization

1. **Clear Separation of Concerns**: Tests are grouped by what they test rather than where the code is located
2. **Easier Test Discovery**: Developers can quickly find tests related to specific functionality
3. **Better Maintenance**: When working on a specific feature, all related tests are in one place
4. **Logical Grouping**: Related tests are grouped together, making it easier to understand dependencies

## Running Tests

To run all unit tests:

```bash
npm test tests/unit/
```

To run tests for a specific category:

```bash
npm test tests/unit/entities/     # Entity tests
npm test tests/unit/systems/      # System tests
npm test tests/unit/server/       # Server tests
npm test tests/unit/utils/        # Utility tests
```

To run a specific test file:

```bash
npm test tests/unit/entities/asteroids.test.ts
npm test tests/unit/systems/collisions.test.ts
npm test tests/unit/server/server-scoring.test.ts
```

## Test Categories Explained

### Entity Tests

These tests focus on individual game entities (ships, asteroids, bots) and their core behaviors. They test:

- Entity creation and initialization
- Entity-specific methods and properties
- Entity interactions with other entities
- Entity lifecycle (creation, damage, destruction, respawn)

### System Tests

These tests focus on game systems that coordinate between entities. They test:

- Collision detection and handling
- Game state management
- UI systems (minimap, scoring display)
- Game flow (game over, respawn mechanics)

### Server Tests

These tests focus on server-side functionality and network communication. They test:

- Server environment configuration
- Network message handling
- Server-side game state management
- Multiplayer synchronization

### Utility Tests

These tests focus on utility functions and configuration. They test:

- Helper functions and utilities
- Configuration management
- Application initialization
- Cross-cutting concerns

## Writing New Tests

When adding new unit tests:

1. **Choose the right category**: Determine if your test is for an entity, system, server, or utility
2. **Follow naming conventions**: Use descriptive test names that explain what is being tested
3. **Keep tests focused**: Each test should test one specific behavior
4. **Use appropriate mocks**: Mock external dependencies to isolate the code under test
5. **Update this README**: Add new test files to the appropriate category list

## Test Structure Guidelines

- **Entity tests**: Test individual entity behavior in isolation
- **System tests**: Test how systems coordinate between entities
- **Server tests**: Test server-side logic and network communication
- **Utility tests**: Test helper functions and configuration

This organization makes the test suite more maintainable and easier to navigate, especially as the codebase grows.
