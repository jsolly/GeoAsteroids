# Environment Variables Documentation

This document describes all environment variables used in the GeoAsteroids project.

## Server Environment Variables

These variables are used when running the server directly (not through Vite). Create a `.env` file in the root directory to set these.

### PORT
- **Default**: `3001`
- **Description**: Port number for the server to listen on
- **Usage**: `PORT=8080`

### NODE_ENV
- **Default**: `production`
- **Description**: Node.js environment mode
- **Usage**: `NODE_ENV=development`

### SERVER_LOG_LEVEL
- **Default**: `info`
- **Values**: `error`, `warn`, `info`, `debug`
- **Description**: Server-side logging level
- **Usage**: `SERVER_LOG_LEVEL=debug`

## Client Environment Variables (VITE_*)

These variables are prefixed with `VITE_` and are available in the client-side code. They can be set in a `.env` file or as system environment variables.

### VITE_WEBSOCKET_URL
- **Default**: `ws://localhost:3001/ws`
- **Description**: WebSocket server URL for multiplayer functionality
- **Usage**: `VITE_WEBSOCKET_URL=ws://my-server.com:9000/ws`

### VITE_CLIENT_LOG_LEVEL
- **Default**: `debug` (development), `info` (production)
- **Values**: `error`, `warn`, `info`, `debug`
- **Description**: Client-side logging level
- **Usage**: `VITE_CLIENT_LOG_LEVEL=debug`

## Debug Environment Variables

These variables are only active when `VITE_CLIENT_LOG_LEVEL=debug`. They provide various debugging and testing features.

### VITE_DEBUG_BOT_COUNT
- **Default**: `1`
- **Description**: Number of AI bots to spawn in debug mode
- **Usage**: `VITE_DEBUG_BOT_COUNT=5`

### VITE_DEBUG_ROID_COUNT
- **Default**: `100`
- **Description**: Number of asteroids to spawn in debug mode
- **Usage**: `VITE_DEBUG_ROID_COUNT=50`

### VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE
- **Default**: `false`
- **Description**: Makes the local player invincible
- **Usage**: `VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE=true`

### VITE_DEBUG_DISABLE_BOT_MOVEMENT
- **Default**: `false`
- **Description**: Disables AI bot movement
- **Usage**: `VITE_DEBUG_DISABLE_BOT_MOVEMENT=true`

### VITE_DEBUG_DISABLE_BOT_LASERS
- **Default**: `false`
- **Description**: Disables AI bot shooting
- **Usage**: `VITE_DEBUG_DISABLE_BOT_LASERS=true`

### VITE_DEBUG_DISABLE_ROID_MOVEMENT
- **Default**: `false`
- **Description**: Disables asteroid movement
- **Usage**: `VITE_DEBUG_DISABLE_ROID_MOVEMENT=true`

### VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION
- **Default**: `false`
- **Description**: Disables spawn protection for bots
- **Usage**: `VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION=true`

### VITE_DEBUG_PLACE_BOTS_NEAR_LOCAL_PLAYER
- **Default**: `false`
- **Description**: Places bots near the local player for testing
- **Usage**: `VITE_DEBUG_PLACE_BOTS_NEAR_LOCAL_PLAYER=true`

### VITE_DEBUG_PLACE_ROID_ON_BOT
- **Default**: `false`
- **Description**: Places asteroids on bots for testing collision detection
- **Usage**: `VITE_DEBUG_PLACE_ROID_ON_BOT=true`

## Build-time Environment Variables

These variables are automatically injected by Vite at build time and should not be manually set.

### VITE_BUILD_TIME
- **Auto-generated**: Current timestamp
- **Description**: Build timestamp in ISO format

### VITE_COMMIT_HASH
- **Auto-generated**: Git commit hash
- **Description**: Short git commit hash of the current build

### MODE
- **Auto-generated**: Build mode
- **Description**: Either `development` or `production`

## Usage Examples

### Development with Debug Features
```bash
# .env file
VITE_CLIENT_LOG_LEVEL=debug
VITE_DEBUG_BOT_COUNT=3
VITE_DEBUG_ROID_COUNT=25
VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE=true
```

### Production Server
```bash
# .env file
PORT=3000
NODE_ENV=production
SERVER_LOG_LEVEL=warn
VITE_WEBSOCKET_URL=ws://my-server.com:3000/ws
VITE_CLIENT_LOG_LEVEL=info
```

### Multiplayer Development
```bash
# Terminal 1: Start server with custom port
PORT=9000 SERVER_LOG_LEVEL=debug npm run dev:multiplayer

# Terminal 2: Start client with custom WebSocket URL
VITE_WEBSOCKET_URL=ws://localhost:9000/ws npm run dev
```

## Verification

All environment variables are tested in `test/env-vars.test.ts`. Run the tests to verify that environment variables are properly applied:

```bash
npm test -- test/env-vars.test.ts
```

## Implementation Notes

- **Server variables**: Use `process.env.VARIABLE_NAME`
- **Client variables**: Use `import.meta.env.VITE_VARIABLE_NAME`
- **Fallbacks**: All variables have sensible defaults
- **Type safety**: Client variables are typed in `src/types/vite-env.d.ts`
- **Build integration**: Vite automatically injects build-time variables
