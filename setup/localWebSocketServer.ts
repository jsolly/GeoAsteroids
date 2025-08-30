import { type WebSocket, WebSocketServer } from 'ws';
import { WebSocketCore } from '../server/core';
import type { ClientMessage } from '../src/multiplayer/types';
import { logger } from './serverLogger';

type WebSocketWithEvents = WebSocket & {
  on(event: string, listener: (...args: unknown[]) => void): void;
};

class LocalMultiplayerServer {
  private wsCore: WebSocketCore;
  public wss: WebSocketServer;

  constructor(port: number = 3001) {
    this.wss = new WebSocketServer({ port });
    this.wsCore = new WebSocketCore();
    this.wsCore.startPeriodicGameStateBroadcast();

    logger.info(`🚀 Local multiplayer server running on ws://localhost:${port}`);

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocketWithEvents) => {
      logger.info('🔌 New player connected');

      ws.on('message', (data: unknown) => {
        try {
          const message = JSON.parse(String(data)) as ClientMessage;
          // Convert the client message to the format expected by the shared core
          const coreMessage = {
            type: message.type,
            ...(message.data as Record<string, unknown>),
          };
          this.wsCore.handleClientMessage(coreMessage, ws);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to parse client message:', errorMessage);
          this.wsCore.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        // Find and remove the player
        for (const player of this.wsCore.getAllPlayers()) {
          if (player.ws === ws) {
            logger.info(`👋 Player ${player.name} (${player.id}) disconnected`);
            this.wsCore.removePlayer(player.id);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('❌ WebSocket error:', errorMessage);
      });
    });
  }

  public getStats(): void {
    logger.info(`📊 Server Stats - Players: ${this.wsCore.getPlayerCount()}`);
  }
}

// Start the server
const server = new LocalMultiplayerServer(3001);

// Log stats every 10 seconds
setInterval(() => server.getStats(), 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n🛑 Shutting down multiplayer server...');
  server.wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n🛑 Shutting down multiplayer server...');
  server.wss.close();
  process.exit(0);
});
