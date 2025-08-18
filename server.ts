import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './setup/serverLogger';

// Production configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'production';

logger.info(`🚀 Starting ${NODE_ENV} multiplayer server on port ${PORT}`);

// Create HTTP server for health checks
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
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
const players = new Map<string, any>();
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
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
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
      logger.error('Failed to parse client message:', error instanceof Error ? error.message : 'Unknown error');
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    logger.info('🔌 Player disconnected');
    // Find and remove the player
    for (const [id, player] of players.entries()) {
      if (player.ws === ws) {
        removePlayer(id);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    logger.error('❌ WebSocket error:', error);
  });
});

// Start the server
httpServer.listen(PORT, () => {
  logger.info(`✅ Server listening on port ${PORT}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

// Player management functions
function addPlayer(id: string, name: string, ws: WebSocket) {
  players.set(id, {
    id,
    name,
    ws,
    lastUpdate: Date.now(),
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    health: 100,
    score: 0,
  });
  logger.info(`👤 Player ${name} (${id}) added`);
}

function removePlayer(id: string) {
  const player = players.get(id);
  if (player) {
    logger.info(`👋 Player ${player.name} (${id}) removed`);
    players.delete(id);
  }
}

function updatePlayer(id: string, data: any) {
  const player = players.get(id);
  if (player) {
    Object.assign(player, data);
    player.lastUpdate = Date.now();
  }
}

function getPlayerCount(): number {
  return players.size;
}

function broadcastToAll(message: any, excludeId?: string) {
  const messageStr = JSON.stringify(message);
  for (const [id, player] of players.entries()) {
    if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(messageStr);
    }
  }
}

function sendToPlayer(id: string, message: any) {
  const player = players.get(id);
  if (player && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, message: string) {
  sendToWebSocket(ws, { type: 'error', message });
}

function sendToWebSocket(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Message handling
function handleClientMessage(message: any, ws: WebSocket) {
  const { type, id, name, ...data } = message;

  switch (type) {
    case 'join':
      if (!id || !name) {
        sendError(ws, 'Missing player ID or name');
        return;
      }
      addPlayer(id, name, ws);
      sendToWebSocket(ws, { type: 'joined', id, name });
      broadcastToAll({ type: 'playerJoined', id, name }, id);
      broadcastGameState();
      break;

    case 'update':
      if (!id) {
        sendError(ws, 'Missing player ID');
        return;
      }
      updatePlayer(id, data);
      broadcastToAll({ type: 'playerUpdate', id, ...data }, id);
      break;

    case 'chat':
      if (!id || !data.message) {
        sendError(ws, 'Missing player ID or message');
        return;
      }
      const player = players.get(id);
      if (player) {
        broadcastToAll({ type: 'chat', id, name: player.name, message: data.message });
      }
      break;

    case 'ping':
      sendToWebSocket(ws, { type: 'pong', timestamp: Date.now() });
      break;

    default:
      logger.warn(`Unknown message type: ${type}`);
      sendError(ws, `Unknown message type: ${type}`);
  }
}

function broadcastGameState() {
  const gameState = {
    type: 'gameState',
    players: Array.from(players.values()).map(({ id, name, position, rotation, health, score }) => ({
      id,
      name,
      position,
      rotation,
      health,
      score,
    })),
    gameTime,
  };
  broadcastToAll(gameState);
}

// Periodic game state broadcast (5 FPS)
setInterval(() => {
  if (players.size > 0) {
    broadcastGameState();
  }
}, 200);
