# Debug Configuration

The debug mode in GeoAsteroids is now fully configurable through environment variables. This allows you to customize the debug experience without modifying code.

## Environment Variables

Add these variables to your `.env` file:

```bash
# Debug Configuration
VITE_DEBUG_BOT_COUNT=1
VITE_DEBUG_DISABLE_MOVEMENT=false
VITE_DEBUG_DISABLE_BOT_MOVEMENT=true
VITE_DEBUG_DISABLE_BOT_GUNS=false
VITE_DEBUG_PLACE_ASTEROID_ON_BOT=false
VITE_DEBUG_DRAW_ASTEROIDS=true
VITE_DEBUG_INVINCIBLE=false
VITE_DEBUG_ASTEROID_COUNT=100
```

## Configuration Options

### `VITE_DEBUG_BOT_COUNT`
- **Default**: `1`
- **Description**: Number of bots to create in debug mode
- **Use case**: Test with different numbers of bots to see how they interact

### `VITE_DEBUG_DISABLE_MOVEMENT`
- **Default**: `false`
- **Description**: Disables all movement in the game (experimental)
- **Use case**: Focus on collision detection and visual effects

### `VITE_DEBUG_DISABLE_BOT_MOVEMENT`
- **Default**: `true`
- **Description**: Disables bot movement, keeping them stationary
- **Use case**: Test bot shooting and collision detection with stationary targets

### `VITE_DEBUG_DISABLE_BOT_GUNS`
- **Default**: `false`
- **Description**: Disables bot shooting capabilities
- **Use case**: Focus on asteroid-bot collisions without laser interference

### `VITE_DEBUG_PLACE_ASTEROID_ON_BOT`
- **Default**: `false`
- **Description**: Places a large asteroid directly on top of each bot when debug mode loads
- **Use case**: Test immediate bot-asteroid collision scenarios and damage systems
- **Note**: Works independently of `VITE_DEBUG_DRAW_ASTEROIDS` for collision testing

### `VITE_DEBUG_DRAW_ASTEROIDS`
- **Default**: `true`
- **Description**: Controls whether asteroids are rendered and extra asteroids are spawned in debug mode
- **Use case**: Disable to test collision detection without visual asteroid clutter

### `VITE_DEBUG_INVINCIBLE`
- **Default**: `false`
- **Description**: Makes the player invincible in debug mode
- **Use case**: Test bot behavior and collision systems without player death

### `VITE_DEBUG_ASTEROID_COUNT`
- **Default**: `100`
- **Description**: Number of extra asteroids to spawn in debug mode
- **Use case**: Control the density of asteroids for testing collision detection

## Usage Examples

### Basic Debug Mode (1 Stationary Bot)
```bash
VITE_DEBUG_BOT_COUNT=1
VITE_DEBUG_DISABLE_BOT_MOVEMENT=true
```

### Multi-Bot Testing (3 Moving Bots)
```bash
VITE_DEBUG_BOT_COUNT=3
VITE_DEBUG_DISABLE_BOT_MOVEMENT=false
```

### Pure Asteroid Testing (No Bots)
```bash
VITE_DEBUG_BOT_COUNT=0
VITE_DEBUG_DISABLE_BOT_MOVEMENT=true
```

### Full Bot Testing (Bots Can Move and Shoot)
```bash
VITE_DEBUG_BOT_COUNT=2
VITE_DEBUG_DISABLE_BOT_MOVEMENT=false
VITE_DEBUG_DISABLE_BOT_GUNS=false
```

### Bot Collision Testing (Asteroids on Stationary Bots)
```bash
VITE_DEBUG_BOT_COUNT=3
VITE_DEBUG_DISABLE_BOT_MOVEMENT=true
VITE_DEBUG_PLACE_ASTEROID_ON_BOT=true
```

### Collision Testing Without Visual Clutter
```bash
VITE_DEBUG_BOT_COUNT=2
VITE_DEBUG_DRAW_ASTEROIDS=false
VITE_DEBUG_PLACE_ASTEROID_ON_BOT=true
VITE_DEBUG_ASTEROID_COUNT=50
```

## Runtime Configuration

You can also update the debug configuration at runtime using the `DebugGameController`:

```typescript
import { DebugGameController } from './src/debug';

const debugController = new DebugGameController();
debugController.enableDebugMode();

// Update configuration at runtime
debugController.updateDebugConfig({
  botCount: 5,
  disableBotMovement: false
});
```

## Current Configuration

To see your current debug configuration, check the console logs when debug mode is enabled. The system will log the configuration being used.

## Benefits

1. **No Code Changes**: Configure debug behavior through environment variables
2. **Flexible Testing**: Easily switch between different debug scenarios
3. **Team Consistency**: Share `.env` files for consistent debug setups
4. **Runtime Updates**: Change configuration without restarting the game
5. **Isolated Testing**: Test specific game systems without interference

## Notes

- Debug mode automatically spawns many asteroids (100 base + 200 extra = 300 total)
- All configuration changes are logged to the console for debugging
- Environment variables are read at startup and can be updated at runtime
