import { WebSocket } from 'ws';
import { GameEngine } from '../core/GameEngine';
import { logger } from '../../setup/serverLogger';

export class GameStateBroadcaster {
  private gameEngine: GameEngine;
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
  }

  public startPeriodicBroadcast(): void {
    if (this.broadcastInterval) {
      return; // Already running
    }

    // Periodic game state broadcast (30 FPS for smooth bot movement)
    this.broadcastInterval = setInterval(() => {
      this.flushExpiredCollabHits();
      if (this.gameEngine.getPlayerCount() > 0) {
        this.broadcastGameState();
      }
    }, 1000 / 30); // 30 FPS (33.33ms) for smooth bot movement
  }

  public stopPeriodicBroadcast(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }

  public broadcastGameState(excludeId?: string): void {
    const gameState = this.gameEngine.getGameState();
    const message = {
      type: 'gameState',
      data: gameState,
      timestamp: Date.now(),
    };

    this.broadcastToAll(message, excludeId);
  }

  public broadcastPlayerLeft(playerId: string): void {
    const message = {
      type: 'playerLeft',
      data: {
        id: playerId,
      },
      timestamp: Date.now(),
    } as const;

    this.broadcastToAll(message, playerId);
  }

  public broadcastPlayerJoined(playerId: string, playerName: string, position: { x: number; y: number }): void {
    const message = {
      type: 'playerJoined',
      data: {
        id: playerId,
        name: playerName,
        position,
      },
      timestamp: Date.now(),
    } as const;

    this.broadcastToAll(message, playerId);
  }

  public broadcastPlayerUpdate(playerId: string, updateData: any): void {
    const message = {
      type: 'playerUpdate',
      data: { id: playerId, ...updateData },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message, playerId);
  }

  public broadcastPlayerShoot(playerId: string, laserStart: any, laserDirection: any): void {
    const timestamp = Date.now();
    const message = {
      type: 'playerShoot',
      data: {
        id: playerId,
        laserStart,
        laserDirection,
      },
      timestamp,
    };

    this.broadcastToAll(message, playerId);
  }

  public broadcastPlayerDamaged(
    targetPlayerId: string,
    attackerId: string,
    damage: number,
    remainingHealth: number,
    isDestroyed: boolean,
    remainingLives?: number
  ): void {
    const message = {
      type: 'playerDamaged',
      data: {
        targetPlayerId,
        attackerId,
        damage,
        remainingHealth,
        isDestroyed,
        ...(remainingLives !== undefined ? { remainingLives } : {}),
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastPlayerKilled(targetPlayerId: string, targetPlayerName: string, attackerId: string): void {
    const message = {
      type: 'playerKilled',
      data: {
        targetPlayerId,
        targetPlayerName,
        attackerId,
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastScoreUpdate(playerId: string, score: number): void {
    const message = {
      type: 'scoreUpdate',
      data: {
        playerId,
        score,
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastAsteroidCreation(asteroids: any[]): void {
    const message = {
      type: 'asteroidCreateBatch',
      data: {
        asteroids: asteroids,
      },
      timestamp: Date.now(),
    };

    logger.debug('Broadcasting asteroid creation batch', {
      asteroidCount: asteroids.length,
    });
    this.broadcastToAll(message);
  }

  public broadcastAsteroidDestruction(
    asteroidId: string,
    extras?: { collabSplit?: boolean; origin?: { x: number; y: number } }
  ): void {
    const message = {
      type: 'asteroidDestroy',
      data: {
        asteroidId,
        collabSplit: extras?.collabSplit === true,
        origin: extras?.origin,
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastAsteroidTagged(event: {
    asteroidId: string;
    shooterId: string;
    expiresAt: number;
  }): void {
    const message = {
      type: 'asteroidTagged',
      data: {
        asteroidId: event.asteroidId,
        shooterId: event.shooterId,
        expiresAt: event.expiresAt,
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  private flushExpiredCollabHits(): void {
    this.gameEngine.flushExpiredCollabHits();
    const expired = this.gameEngine.drainResolvedCollabHits();
    for (const item of expired) {
      const player = this.gameEngine.getPlayer(item.playerId);
      if (player) {
        this.broadcastScoreUpdate(item.playerId, player.score);
      }
      this.broadcastAsteroidDestruction(item.destroyed.id, {
        collabSplit: false,
        origin: item.destroyed.position,
      });
    }
  }

  public broadcastAsteroidUpdate(asteroidId: string, updates: any): void {
    const message = {
      type: 'asteroidUpdate',
      data: { asteroidId, updates },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastBotCreation(bots: any[]): void {
    const botSummaries = bots.map(bot => ({
      botId: bot.id,
      botName: bot.name,
      position: bot.position,
    }));

    const message = {
      type: 'botsCreated',
      data: {
        bots: botSummaries,
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastBotUpdate(botId: string): void {
    const bot = this.gameEngine.getBot(botId);
    if (bot) {
      const message = {
        type: 'botUpdate',
        data: {
          botId: bot.id,
          playerId: 'server',
          position: bot.position,
          velocity: bot.velocity,
          angle: bot.angle,
          exploding: bot.exploding,
          thrusting: bot.thrusting,
          color: bot.color,
          lives: bot.lives,
          health: bot.health,
          maxHealth: bot.maxHealth,
          mass: bot.mass,
          kitId: bot.kitId,
          factionId: bot.factionId,
          abilityCooldownFrames: bot.abilityCooldownFrames,
          abilityActiveFrames: bot.abilityActiveFrames,
          shieldTimer: bot.shieldTimer,
          harpoonTimer: bot.harpoonTimer,
          harpoonTargetId: bot.harpoonTargetId,
          shieldActive: bot.shieldActive,
          shieldTime: bot.shieldTime,
          shieldCooldown: bot.shieldCooldown,
          shieldFlashTime: bot.shieldFlashTime,
        },
        timestamp: Date.now(),
      };

      this.broadcastToAll(message);
    }
  }

  public broadcastBotDestroyed(botId: string): void {
    const message = {
      type: 'botDestroyed',
      data: { botId },
      timestamp: Date.now(),
    };

    this.broadcastToAll(message);
  }

  public broadcastChatMessage(playerId: string, playerName: string, message: string): void {
    const chatMessage = {
      type: 'chat',
      data: {
        id: playerId,
        name: playerName,
        message,
      },
      timestamp: Date.now(),
    };

    this.broadcastToAll(chatMessage);
  }

  public sendToWebSocket(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public sendError(ws: WebSocket, message: string): void {
    this.sendToWebSocket(ws, {
      type: 'error',
      data: message,
      timestamp: Date.now(),
    });
  }

  public broadcastToAll(message: any, excludeId?: string): void {
    const messageStr = JSON.stringify(message);
    const humanPlayers = this.gameEngine.entityManager.getHumanPlayers();

    for (const player of humanPlayers) {
      if (excludeId && player.id === excludeId) {
        continue;
      }

      if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        try {
          player.ws.send(messageStr);
        } catch (error) {
          logger.error(`Failed to send message to player ${player.id} (readyState: ${player.ws.readyState})`, error);
          // For unrecoverable errors, close the connection and remove the player
          try {
            player.ws.close();
          } catch (closeError) {
            logger.error(`Failed to close WebSocket for player ${player.id}`, closeError);
          }
          // Remove the player from the game engine
          this.gameEngine.removePlayer(player.id);
          this.broadcastPlayerLeft(player.id);
        }
      }
    }
  }
}
