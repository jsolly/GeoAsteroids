# GeoAsteroids

[![GeoAsteroids](https://github.com/jsolly/GeoAsteroids/actions/workflows/onMain.yml/badge.svg)](https://github.com/jsolly/GeoAsteroids/actions/workflows/onMain.yml)
[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

A 2D spaceship game, <a href="https://geoasteroids.com" target="_blank" >Geoasteroids.com</a>

---

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Installation

1. (Install <a href="https://nodejs.org/en/" rel="noopener noreferrer">Node.js</a>)
2. (Install <a href="https://www.mongodb.com/try/download/community" rel="noopener noreferrer">MongoDB</a>) (Or use a cloud service like <a href="https://www.mongodb.com/cloud/atlas" rel="noopener noreferrer">MongoDB Atlas</a>)

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

### Environment Variables

The following environment variables can be configured:

#### Debug Mode
- `VITE_CLIENT_LOG_LEVEL=debug` - Automatically enables all debug features and settings
- `VITE_DEBUG_BOT_COUNT` - Number of bots to spawn in debug mode (default: 1)
- `VITE_DEBUG_ROID_COUNT` - Alternative roid count control for debug mode
- `VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE=true` - Makes the local player invincible in debug mode
- `VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION=true` - Disables bot spawn protection in debug mode
- `VITE_DEBUG_DISABLE_BOT_MOVEMENT=true` - Disables bot movement when set to 'true'
- `VITE_DEBUG_DISABLE_BOT_LASERS=false` - Disables bot shooting when set to 'true'
- `VITE_DEBUG_PLACE_ROID_ON_BOT=false` - Places roids on bots for testing
- `VITE_DEBUG_DISABLE_ROID_MOVEMENT=true` - Disables roid movement when set to 'true'

#### Logging
- `VITE_CLIENT_LOG_LEVEL` - Sets the client-side log level (error, warn, info, debug)

#### Multiplayer
- `VITE_WEBSOCKET_URL` - WebSocket server URL for multiplayer
- `VITE_MULTIPLAYER_ENABLED` - Enable/disable multiplayer (default: true)

#### Build Info
- `VITE_BUILD_TIME` - Build timestamp (auto-generated)
- `VITE_COMMIT_HASH` - Git commit hash (auto-generated)

### Multiplayer Development Setup

For local multiplayer development, use the following commands:

```shell
# Run all development servers (Vite + WebSocket)
npm run dev:full

# Run individual servers
npm run dev              # Vite dev server (port 5173)
npm run dev:multiplayer  # WebSocket server (port 3001)
```


## Tests, Linting

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

Want to work on this with me? DM me on X <a href="https://x.com/_jsolly" target="_blank">`@_jsolly`</a>

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
