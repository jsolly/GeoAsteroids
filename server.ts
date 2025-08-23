import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './setup/serverLogger';
import { WebSocketCore } from './server/core';

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
        players: wsCore.getPlayerCount(),
        uptime: process.uptime(),
      })
    );
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GeoRoids Multiplayer Server - Running');
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
const wsCore = new WebSocketCore();
wsCore.startPeriodicGameStateBroadcast();

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
      wsCore.handleClientMessage(message, ws);
    } catch (error) {
      logger.error('Failed to parse client message:', error instanceof Error ? error.message : 'Unknown error');
      wsCore.sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    logger.info('🔌 Player disconnected');
    // Find and remove the player
    for (const player of wsCore.getAllPlayers()) {
      if (player.ws === ws) {
        wsCore.removePlayer(player.id);
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
