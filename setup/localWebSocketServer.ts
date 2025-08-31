import { type WebSocket, WebSocketServer } from 'ws';
import { WebSocketCore } from '../server/communication/WebSocketCore';
import { GameEngine } from '../server/core/GameEngine';
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
    const gameEngine = new GameEngine();
    this.wsCore = new WebSocketCore(gameEngine);
    this.wsCore.startPeriodicGameStateBroadcast();

    logger.info('MULTIPLAYER', 'Local multiplayer server started', { port });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocketWithEvents) => {
      logger.info('MULTIPLAYER', 'New player connected');

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
          logger.error('MULTIPLAYER', 'Failed to parse client message', new Error(errorMessage));
          this.wsCore.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        // Find and remove the player
        for (const player of this.wsCore.getAllPlayers()) {
          if (player.ws === ws) {
            logger.info('MULTIPLAYER', 'Player disconnected', {
              playerName: player.name,
              playerId: player.id,
            });
            this.wsCore.removePlayer(player.id);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('MULTIPLAYER', 'WebSocket error', new Error(errorMessage));
      });
    });
  }

  public getStats(): void {
    logger.info('MULTIPLAYER', 'Server stats', {
      playerCount: this.wsCore.getPlayerCount(),
    });
  }
}

// Start the server
const server = new LocalMultiplayerServer(3001);

// Log stats every 10 seconds
setInterval(() => server.getStats(), 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('MULTIPLAYER', 'Shutting down multiplayer server (SIGINT)');
  server.wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('MULTIPLAYER', 'Shutting down multiplayer server (SIGTERM)');
  server.wss.close();
  process.exit(0);
});
