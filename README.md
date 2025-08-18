# GeoAsteroids

[![GeoAsteroidsTest](https://github.com/jsolly/GeoAsteroids/actions/workflows/GeoAsteroidsTest.yml/badge.svg)](https://github.com/jsolly/GeoAsteroids/actions/workflows/GeoAsteroidsTest.yml)
[![Coverage Status](https://coveralls.io/repos/github/jsolly/GeoAsteroids/badge.svg?branch=main)](https://coveralls.io/github/jsolly/GeoAsteroids?branch=main)
[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

A 2D spaceship game, <a href="https://geoasteroids.com" target="_blank" >Geoasteroids.com</a>

![GeoAsteroids_playthrough (3)](https://user-images.githubusercontent.com/9572232/179308016-71265497-1d05-4750-bfd5-0f336cf7ae77.gif)

---

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Installation

1 - (Install <a href="https://nodejs.org/en/" rel="noopener noreferrer">Node.js</a>
2 - (Install <a href="https://www.mongodb.com/try/download/community" rel="noopener noreferrer">MongoDB</a>) (Or use a cloud service like <a href="https://www.mongodb.com/cloud/atlas" rel="noopener noreferrer">MongoDB Atlas</a>)

```shell
    $ git clone git@github.com:jsolly/GeoAsteroids.git
    $ cd GeoAsteroids
    $ npm install
```

## Setup

```shell
  $ cd <mongoDB_install_dir>/bin
  # Start MongoDB Server Locally (Or use a cloud service like MongoDB Atlas)
  $ ./mongod --dbpath <path to data directory>
  $ mongo # Or use a GUI like MongoDB Compass
  $ use geoasteroids
  $ db.createCollection("highscores")
  # Check src/database.ts for connection string
  $ vercel dev # Allows us to mock serverless functions locally
```

## Development

### Multiplayer Development Setup

For local multiplayer development, use the following commands:

```shell
# Run all development servers (Vite + WebSocket)
npm run dev:full

# Run individual servers
npm run dev              # Vite dev server (port 5173)
npm run dev:multiplayer  # WebSocket server (port 3001)
```

### Logging System

GeoAsteroids includes a comprehensive logging system that automatically captures all game events, multiplayer interactions, and debug information.

#### Console Logging

All logs are output directly to the browser console with proper formatting:
- **Timestamp**: ISO format for precise timing
- **Level**: DEBUG, INFO, WARN, ERROR
- **Category**: SHIP_STATE, COLLISION, MULTIPLAYER, etc.
- **Message**: Human-readable description
- **Data**: Optional structured data in JSON format

#### What Gets Logged

- **Game Events**: Ship movements, asteroid collisions, scoring
- **Multiplayer**: Player connections, disconnections, state updates
- **Debug Info**: Viewport calculations, player rendering, test player creation
- **System**: Logger initialization, environment variables, error handling

#### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0, // Detailed debug information
  INFO = 1, // General information
  WARN = 2, // Warning messages
  ERROR = 3, // Error messages
}
```

#### Environment Variables

Control logging verbosity with the `VITE_LOG_LEVEL` environment variable:

```bash
# .env file
VITE_LOG_LEVEL=debug    # Show all logs (default)
VITE_LOG_LEVEL=info     # Show info, warn, error only
VITE_LOG_LEVEL=warn     # Show warn and error only
VITE_LOG_LEVEL=error    # Show errors only
```

#### Browser Console Access

The logger is available globally in the browser console:
```javascript
// View all logs
logger.getLogs()

// Download logs as file
downloadLogs()

// Clear log buffer
clearLogs()

// Search logs
searchLogs('ship')
```



#### Multiplayer Testing Commands

```javascript
// Create test players for demonstration
multiplayer.createTestPlayers();

// Show current multiplayer state
multiplayer.debugState();

// Get all connected players
multiplayer.getPlayers();

// Get player count
multiplayer.getPlayerCount();

// Make ship invincible for testing
multiplayer.makeInvincible();
```

---

## Production Configuration

### Environment Variables

For production deployments, ensure these settings are configured:

```bash
# Production Settings (.env)
VITE_LOG_LEVEL=info
VITE_INVINCIBLE=false
VITE_ENABLE_MOCK_PLAYERS=false  # CRITICAL: Must be false in production
VITE_WEBSOCKET_URL=ws://your-production-server.com:3001
VITE_DEBUG=false
VITE_MULTIPLAYER_DEBUG=false
```

### Test Players Security

**Test players are development/testing only and should NEVER exist in production:**

- Test players are only created when `VITE_ENABLE_MOCK_PLAYERS=true`
- This environment variable defaults to `false` if not set
- Test players are completely disabled in production builds
- All test player creation is gated behind environment checks

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Test Players | `VITE_ENABLE_MOCK_PLAYERS=true` | `VITE_ENABLE_MOCK_PLAYERS=false` |
| Debug Mode | `VITE_DEBUG=true` | `VITE_DEBUG=false` |
| Log Level | `VITE_LOG_LEVEL=debug` | `VITE_LOG_LEVEL=info` |
| Invincibility | `VITE_INVINCIBLE=true` | `VITE_INVINCIBLE=false` |

---

## Features

#### Functional

- Moving asteroids with variable jaggedness and size. Woah
- Points, lives, and levels just like you'd expect
- Spaceship with laser and thruster. Pew Pew
- **EMP Pulse ability** - Press 'E' to destroy all asteroids and bots within radius! ⚡
- Global high scoreboard so you can compete with anyone in the world!
- **Multiplayer support** with real-time player synchronization
- **Local WebSocket server** for development and testing
- **Test player system** for testing multiplayer functionality

#### Controls

- **Arrow Keys**: Move and rotate the ship
- **Space**: Shoot laser
- **E**: Activate EMP Pulse (destroys all nearby asteroids and bots)
- **Mouse**: Navigate menus

#### Non-Functional

- Asteroid collisions detection, so you die when you're supposed to
- Static code analysis using CodeQL so the code is less likely to have security vulnerabilities
- NPM Dependency checking via Dependabot so you don't have to think about it
- 100% linted with Biome for a more maintainable and consistent codebase
- TypeScript under 'strict' mode with no errors, so you know we're following TS best practices
- JS bundling with Vite for a super fast front-end
- Serverless functions for API calls, so you don't have to worry too much about handling the backend
- MongoDB database for high scores cause who wants to deal with flat files?
- **Comprehensive logging system** with automatic file output and HTTP endpoints
- **Real-time multiplayer debugging** with structured logs and player state tracking
- **Environment-based configuration** for debug modes and multiplayer features
- Over 90% test coverage so you can refactor and add features with peace of mind

## Coverage, Tests, Linting

### Coverage

```shell
npm run coverage
```

### Test

```shell
npm run test
```

### Linting (with Biome)

```shell
npm run lint
```

- Biome is now configured using `biome.jsonc` for fast, reliable linting and formatting.
- The old ESLint configuration has been removed in favor of Biome's unified approach.
- To update rules or configuration, edit `biome.jsonc`.

---

## Contributing

Want to work on this with me? DM me on Twiiter <a href="https://twitter.com/_jsolly" target="_blank">`@_jsolly`</a>

### Step 1

- **Option 1**
  - 🍴 Fork this repo!

- **Option 2**
  - 👯 Clone to your local machine using `git@github.com:jsolly/GeoAsteroids.git`

### Step 2

- **HACK AWAY!** 🔨🔨🔨

### Step 3

- 🔃 Create a new pull request using <a href="https://github.com/jsolly/GeoAsteroids/compare" target="_blank">`https://github.com/jsolly/GeoAsteroids/compare`</a>.

---

## UML Diagram

<img src="config/geoAsteroidsUML.png" alt="GeoAsteroids UML diagram"></img>

---

## License

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

- **[MIT license](http://opensource.org/licenses/mit-license.php)**
