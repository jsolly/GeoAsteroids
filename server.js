import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from './setup/serverLogger.js';

// Production configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'production';

logger.info(`🚀 Starting ${NODE_ENV} multiplayer server on port ${PORT}`);

// Create HTTP server for health checks
const httpServer = createServer((req, res) => {
  // Add CORS headers for production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        players: getPlayerCount(),
        uptime: process.uptime(),
      })
    );
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GeoAsteroids Multiplayer Server - Running');
  } else if (req.url === '/ws') {
    // Handle WebSocket upgrade
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('WebSocket connections should use ws:// protocol');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws', // Add specific path for WebSocket connections
});

// Add error handling for WebSocket server
wss.on('error', (error) => {
  logger.error('❌ WebSocket server error:', error);
});

wss.on('headers', (headers) => {
  logger.debug('📋 WebSocket upgrade headers:', headers);
});

// Player management
const players = new Map();
let gameTime = 0;

// Game loop for cleanup (10 FPS)
setInterval(() => {
  gameTime++;

  // Clean up stale players (haven't updated in 30 seconds)
  const now = Date.now();
  for (const [id, player] of players.entries()) {
    if (now - player.lastUpdate > 30000) {
      logger.debug(`🧹 Cleaning up stale player ${player.name} (${id})`);
      removePlayer(id);
    }
  }
}, 100);

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('🔌 New player connected');
  logger.debug('📍 Connection details:', {
    url: req.url,
    headers: req.headers,
    remoteAddress: req.socket.remoteAddress,
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(String(data));
      handleClientMessage(message, ws);
    } catch (error) {
      logger.error('Failed to parse client message:', error.message);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    // Find and remove the player
    for (const [id, player] of players.entries()) {
      if (player.ws === ws) {
        logger.info(`👋 Player ${player.name} (${id}) disconnected`);
        removePlayer(id);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    logger.error('❌ WebSocket error:', error.message);
  });
});

// Message handling
function handleClientMessage(message, ws) {
  try {
    switch (message.type) {
      case 'join':
        handlePlayerJoin(message.data, ws);
        break;
      case 'leave':
        handlePlayerLeave(message.data);
        break;
      case 'update':
        handlePlayerUpdate(message.data);
        break;
      case 'shoot':
        handlePlayerShoot(message.data);
        break;
      default:
        sendError(ws, 'Unknown message type');
    }
  } catch (error) {
    console.error('Error handling client message:', error.message);
    sendError(ws, 'Internal server error');
  }
}

// Player join handling
function handlePlayerJoin(data, ws) {
  const player = {
    ...data,
    velocity: { x: 0, y: 0 },
    r: 0,
    a: 0,
    lives: 3,
    score: 0,
    dead: false,
    exploding: false,
    lastUpdate: Date.now(),
    ws,
  };

  players.set(player.id, player);
  logger.info(`🎮 Player ${player.name} (${player.id}) joined the game`);

  // Send confirmation to the joining player
  const joinMessage = {
    type: 'playerJoin',
    data: {
      id: player.id,
      name: player.name,
      position: player.ship.position,
    },
    timestamp: Date.now(),
  };
  ws.send(JSON.stringify(joinMessage));

  // Send current game state to the new player
  sendGameState(player.id);

  // Broadcast to all other players
  broadcastToOthers(ws, joinMessage);
}

// Player leave handling
function handlePlayerLeave(data) {
  removePlayer(data.id);
}

// Player update handling
function handlePlayerUpdate(data) {
  const player = players.get(data.id);
  if (player) {
    // Update player data
    Object.assign(player, data);
    player.lastUpdate = Date.now();

    // Broadcast update to all other players
    const updateMessage = {
      type: 'playerUpdate',
      data: {
        id: player.id,
        position: player.ship.position,
        velocity: player.ship.velocity,
        r: player.ship.r,
        a: player.ship.a,
        lives: player.lives,
        score: player.score,
        dead: player.dead,
        exploding: player.ship.exploding,
      },
      timestamp: Date.now(),
    };
    broadcastToOthers(player.ws, updateMessage);
  }
}

// Player shoot handling
function handlePlayerShoot(data) {
  // Broadcast shoot event to all other players
  const shootMessage = {
    type: 'playerShoot',
    data: {
      id: data.id,
      laserStart: data.laserStart,
      laserDirection: data.laserDirection,
    },
    timestamp: Date.now(),
  };

  const shooter = players.get(data.id);
  if (shooter) {
    broadcastToOthers(shooter.ws, shootMessage);
  }
}

// Send game state to a specific player
function sendGameState(playerId) {
  const player = players.get(playerId);
  if (!player) {
    return;
  }

  const gameState = {
    type: 'gameState',
    data: {
      players: Array.from(players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        velocity: p.velocity,
        r: p.r,
        a: p.a,
        lives: p.lives,
        score: p.score,
        dead: p.dead,
        exploding: p.exploding,
      })),
      asteroids: [], // Will be implemented in Phase 2
      gameTime: gameTime,
    },
    timestamp: Date.now(),
  };

  try {
    player.ws.send(JSON.stringify(gameState));
  } catch (error) {
    logger.error(`Failed to send game state to player ${playerId}:`, error.message);
  }
}

// Remove player
function removePlayer(id) {
  const player = players.get(id);
  if (player) {
    // Close the WebSocket connection
    try {
      player.ws.close();
    } catch (error) {
      logger.error('Error closing WebSocket:', error.message);
    }

    // Remove from players map
    players.delete(id);

    // Broadcast leave message to remaining players
    const leaveMessage = {
      type: 'playerLeave',
      data: { id },
      timestamp: Date.now(),
    };
    broadcastToAll(leaveMessage);

    logger.info(`👋 Player ${player.name} (${id}) removed. Total players: ${players.size}`);
  }
}

// Broadcast to all players
function broadcastToAll(message) {
  const messageStr = JSON.stringify(message);
  for (const player of players.values()) {
    try {
      if (player.ws.readyState === 1) {
        // WebSocket.OPEN
        player.ws.send(messageStr);
      }
    } catch (error) {
      logger.error('Error broadcasting message:', error.message);
    }
  }
}

// Broadcast to all players except one
function broadcastToOthers(excludeWs, message) {
  const messageStr = JSON.stringify(message);
  for (const player of players.values()) {
    if (player.ws !== excludeWs && player.ws.readyState === 1) {
      // WebSocket.OPEN
      try {
        player.ws.send(messageStr);
      } catch (error) {
        logger.error('Error broadcasting message:', error.message);
      }
    }
  }
}

// Send error message
function sendError(ws, message) {
  try {
    ws.send(JSON.stringify({ type: 'error', message }));
  } catch (error) {
    logger.error('Error sending error message:', error.message);
  }
}

// Get player count
function getPlayerCount() {
  return players.size;
}

// Log stats every 30 seconds
setInterval(() => {
  logger.info(`📊 Server Stats - Players: ${getPlayerCount()}, Game Time: ${gameTime}`);
}, 30000);

// Start the server
httpServer.listen(PORT, () => {
  logger.info(`🚀 Multiplayer server running on port ${PORT}`);
  logger.info(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
  logger.info(`📱 Root endpoint: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n🛑 Shutting down multiplayer server...');
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n🛑 Shutting down multiplayer server...');
  httpServer.close();
  process.exit(0);
});
