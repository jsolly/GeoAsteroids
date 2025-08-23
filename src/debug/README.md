# Debug System Documentation

This directory contains the debug system for GeoAsteroids, designed to provide debugging capabilities without polluting the main application code.

## Architecture

The debug system follows a clean separation of concerns:

- **Debug Config** (`debugConfig.ts`): Central configuration management
- **Debug Managers** (`debugCollisionManager.ts`, etc.): Debug-specific logic
- **Debug Wrappers** (`debugCollisionWrapper.ts`): Debug-enhanced versions of core functions
- **Main Debug Manager** (`debugManager.ts`): Orchestrates all debug functionality

## Key Features

### Collision Testing

The debug system provides enhanced collision detection for testing purposes:

```typescript
import { DebugCollisionWrapper } from './debug/debugCollisionWrapper';

// Use debug-enhanced collision detection
const debugCollisions = DebugCollisionWrapper.getInstance();
debugCollisions.detectBotAsteroidCollisions(bots, asteroidBelt);
```

### Spawn Protection Override

To test collision systems immediately without waiting for bot spawn protection to expire:

```bash
# Set this environment variable to disable bot spawn protection
VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION=true
```

This allows bots to take damage from collisions even during their normal invincibility period.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DEBUG` | `false` | Enable debug mode |
| `VITE_DEBUG_BOT_COUNT` | `1` | Number of bots to create |
| `VITE_DEBUG_PLACE_ASTEROID_ON_BOT` | `false` | Place asteroids on bots for collision testing |
| `VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION` | `false` | Disable bot spawn protection for immediate collision testing |
| `VITE_DEBUG_DISABLE_BOT_MOVEMENT` | `true` | Disable bot movement |
| `VITE_DEBUG_DISABLE_BOT_GUNS` | `false` | Disable bot shooting |
| `VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE` | `false` | Make local player invincible |
| `VITE_DEBUG_DRAW_ASTEROIDS` | `true` | Draw asteroids in debug mode |

## Usage Example

```typescript
// In your game loop or collision detection code
if (isDebugModeEnabled()) {
  const debugCollisions = DebugCollisionWrapper.getInstance();
  debugCollisions.detectBotAsteroidCollisions(bots, asteroidBelt);
} else {
  // Use normal collision detection
  detectBotAsteroidCollisions(bots, asteroidBelt);
}
```

## Benefits

1. **Clean Separation**: Debug code is completely isolated from production code
2. **Configurable**: All debug behavior is controlled via environment variables
3. **Maintainable**: Debug features can be added/modified without touching core game logic
4. **Performance**: Debug code only runs when explicitly enabled
5. **Testable**: Debug functionality can be unit tested independently

## Adding New Debug Features

1. Add new options to `DebugConfig` interface
2. Implement logic in appropriate debug manager classes
3. Create debug wrappers if needed for core functionality
4. Document the new feature in this README
5. Add corresponding environment variable documentation
