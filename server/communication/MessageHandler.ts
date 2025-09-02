import { WebSocket } from 'ws';
import { GameEngine } from '../core/GameEngine';
import { GameStateBroadcaster } from '../services/GameStateBroadcaster';
import { ClientLogger } from '../services/ClientLogger';
import { logger } from '../../setup/serverLogger';
import type { ServerBot } from '../core/BotManager';

export class MessageHandler {
  private gameEngine: GameEngine;
  private broadcaster: GameStateBroadcaster;

  constructor(gameEngine: GameEngine, broadcaster: GameStateBroadcaster) {
    this.gameEngine = gameEngine;
    this.broadcaster = broadcaster;
  }

  public handleMessage(message: any, ws: WebSocket): void {
    // Accept both top-level fields and nested data payloads for compatibility
    const type = message.type;
    const payload = typeof message.data === 'object' && message.data !== null ? message.data : {};
    const id = message.id ?? payload.id;
    const name = message.name ?? payload.name;
    const restData = { ...payload, ...message };
    delete (restData as any).type;
    delete (restData as any).id;
    delete (restData as any).name;
    
    // Don't delete data field for clientLog messages as they need the nested structure
    if (type !== 'clientLog') {
      delete (restData as any).data;
    }

    try {
      switch (type) {
        case 'join':
          this.handleJoin(ws, id, name, restData);
          break;

        case 'update':
          this.handlePlayerUpdate(ws, id, restData);
          break;

        case 'shoot':
          this.handlePlayerShoot(ws, id, restData);
          break;

        case 'chat':
          this.handleChat(ws, id, restData);
          break;

        case 'laserDamage':
          this.handleLaserDamage(ws, restData);
          break;

        case 'collisionDamage':
          this.handleCollisionDamage(ws, restData);
          break;

        case 'botDamage':
          this.handleBotDamage(ws, restData);
          break;

        case 'asteroidDestroyed':
          this.handleAsteroidDestroyed(ws, restData);
          break;

        case 'initAsteroids':
          this.handleInitAsteroids(ws, id, restData);
          break;

        case 'asteroidUpdate':
          this.handleAsteroidUpdate(ws, restData);
          break;

        case 'asteroidDestroy':
          this.handleAsteroidDestroy(ws, restData);
          break;

        case 'initBots':
          this.handleInitBots(ws, id, restData);
          break;

        case 'botUpdate':
          this.handleBotUpdate(ws, restData);
          break;

        case 'botDestroyed':
          this.handleBotDestroyed(ws, restData);
          break;

        case 'clientLog':
          this.handleClientLog(restData);
          break;

        case 'ping':
          this.handlePing(ws);
          break;

        default:
          logger.warn(`Unknown message type: ${type}`);
          this.broadcaster.sendError(ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      this.broadcaster.sendError(ws, 'Internal server error');
    }
  }

  private handleJoin(ws: WebSocket, id: string, name: string, data: any): void {
    logger.debug('🔌 Handling join message', { id, name, data });
    
    if (!id || !name) {
      logger.warn('❌ Missing player ID or name for join', { id, name });
      this.broadcaster.sendError(ws, 'Missing player ID or name');
      return;
    }

    // Handle position if provided by client
    const joinPosition = this.gameEngine.validatePosition(data.position) || { x: 0, y: 0 };
    logger.debug('📍 Player join position', { id, position: joinPosition });

    this.gameEngine.addPlayer(id, name, ws, joinPosition);
    logger.info('✅ Player added to game engine', { id, name });

    // Send confirmation to the joining player
    this.broadcaster.sendToWebSocket(ws, {
      type: 'joined',
      data: {
        id,
        name,
        position: joinPosition,
      },
      timestamp: Date.now(),
    });
    logger.debug('📤 Sent joined confirmation', { id, name });

    // Broadcast to all other players
    this.broadcaster.broadcastPlayerJoined(id, name, joinPosition);
    this.broadcaster.broadcastGameState();
    logger.debug('📢 Broadcasted player joined and game state', { id, name });
  }

  private handlePlayerUpdate(ws: WebSocket, id: string, data: any): void {
    if (!id) {
      this.broadcaster.sendError(ws, 'Missing player ID');
      return;
    }

    // Server-authoritative health: ignore client-sent health fields
    const sanitizedData: any = { ...data };
    delete (sanitizedData as any).health;
    delete (sanitizedData as any).maxHealth;

    // Normalize client fields to server schema
    if (sanitizedData.angle !== undefined && sanitizedData.rotation === undefined) {
      sanitizedData.rotation = sanitizedData.angle;
    }
    if (sanitizedData.a !== undefined && sanitizedData.angularVelocity === undefined) {
      sanitizedData.angularVelocity = sanitizedData.a;
    }

    const player = this.gameEngine.updatePlayer(id, sanitizedData);
    if (!player) {
      return; // Player not found
    }

    // Include laser data if provided
    const updateData: any = { ...sanitizedData };
    if (sanitizedData.lasers !== undefined) {
      updateData.lasers = sanitizedData.lasers;
    }

    this.broadcaster.broadcastPlayerUpdate(id, updateData);
  }

  private handlePlayerShoot(ws: WebSocket, id: string, data: any): void {
    if (!id) {
      this.broadcaster.sendError(ws, 'Missing player ID for shoot');
      return;
    }

    this.broadcaster.broadcastPlayerShoot(id, data.laserStart, data.laserDirection);
  }

  private handleChat(ws: WebSocket, id: string, data: any): void {
    if (!id || !data.message) {
      this.broadcaster.sendError(ws, 'Missing player ID or message');
      return;
    }

    const player = this.gameEngine.getPlayer(id);
    if (player) {
      this.broadcaster.broadcastChatMessage(id, player.name, data.message);
    }
  }

  private handleLaserDamage(ws: WebSocket, data: any): void {
    if (!data.targetPlayerId || !data.attackerId || data.damage === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for laserDamage');
      return;
    }

    const isDestroyed = this.gameEngine.handlePlayerDamage(data.targetPlayerId, data.attackerId, data.damage);

    const targetPlayer = this.gameEngine.getPlayer(data.targetPlayerId);
    if (targetPlayer) {
      this.broadcaster.broadcastPlayerDamaged(
        data.targetPlayerId,
        data.attackerId,
        data.damage,
        targetPlayer.health ?? 0,
        isDestroyed
      );

      // Broadcast score update if points were awarded
      if (isDestroyed) {
        const attacker = this.gameEngine.getPlayer(data.attackerId);
        if (attacker) {
          this.broadcaster.broadcastScoreUpdate(data.attackerId, attacker.score);
        }
        
        // Broadcast player killed event to notify the killer
        this.broadcaster.broadcastPlayerKilled(data.targetPlayerId, targetPlayer.name, data.attackerId);
      }
    }
  }

  private handleCollisionDamage(ws: WebSocket, data: any): void {
    if (!data.targetPlayerId || !data.attackerId || data.damage === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for collisionDamage');
      return;
    }

    let isDestroyed = false;
    let remainingHealth = 0;
    let targetName = '';

    // Check if target is a bot or player
    if (data.targetPlayerId.startsWith('server-bot-')) {
      // Target is a bot
      isDestroyed = this.gameEngine.handleBotDamage(data.targetPlayerId, data.attackerId, data.damage);
      const targetBot = this.gameEngine.getBot(data.targetPlayerId);
      if (targetBot) {
        remainingHealth = targetBot.health;
        targetName = targetBot.name;
        // Always broadcast bot update after damage
        this.broadcaster.broadcastBotUpdate(data.targetPlayerId);
      }
    } else {
      // Target is a player
      isDestroyed = this.gameEngine.handlePlayerDamage(data.targetPlayerId, data.attackerId, data.damage);
      const targetPlayer = this.gameEngine.getPlayer(data.targetPlayerId);
      if (targetPlayer) {
        remainingHealth = targetPlayer.health ?? 0;
        targetName = targetPlayer.name;
        this.broadcaster.broadcastPlayerDamaged(
          data.targetPlayerId,
          data.attackerId,
          data.damage,
          remainingHealth,
          isDestroyed
        );
      }
    }

    // Handle destruction for both players and bots
    if (isDestroyed) {
      const attacker = this.gameEngine.getPlayer(data.attackerId);
      if (attacker) {
        this.broadcaster.broadcastScoreUpdate(data.attackerId, attacker.score);
      }

      if (data.targetPlayerId.startsWith('server-bot-')) {
        // Bot was destroyed
      } else {
        // Player was destroyed
        this.broadcaster.broadcastPlayerKilled(data.targetPlayerId, targetName, data.attackerId);
      }
    }
  }

  private handleBotDamage(ws: WebSocket, data: any): void {
    if (!data.botId || !data.attackerId || data.damage === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for botDamage');
      return;
    }

    const isDestroyed = this.gameEngine.handleBotDamage(data.botId, data.attackerId, data.damage);

    // Always broadcast bot update after damage to ensure health synchronization
    this.broadcaster.broadcastBotUpdate(data.botId);

    if (isDestroyed) {
      // Broadcast score update for attacker
      const attacker = this.gameEngine.getPlayer(data.attackerId);
      if (attacker) {
        this.broadcaster.broadcastScoreUpdate(data.attackerId, attacker.score);
      }
    }
  }

  private handleAsteroidDestroyed(ws: WebSocket, data: any): void {
    if (!data.asteroidId || !data.playerId || data.points === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for asteroidDestroyed');
      return;
    }

    const result = this.gameEngine.handleAsteroidDestruction(data.asteroidId, data.playerId, data.points);

    if (result.success) {
      // Broadcast score update
      const player = this.gameEngine.getPlayer(data.playerId);
      if (player) {
        this.broadcaster.broadcastScoreUpdate(data.playerId, player.score);
      }

      // Broadcast asteroid destruction
      this.broadcaster.broadcastAsteroidDestruction(data.asteroidId);

      // Broadcast new asteroids created from splitting if any
      if (result.newAsteroids.length > 0) {
        this.broadcaster.broadcastAsteroidCreation(result.newAsteroids);
      }
    }
  }

  private handleInitAsteroids(ws: WebSocket, id: string, data: any): void {
    if (!id) {
      this.broadcaster.sendError(ws, 'Missing player ID for initAsteroids');
      return;
    }

    const currentAsteroidCount = this.gameEngine.getAsteroidCount();
    
    // If no asteroids exist, create them
    if (currentAsteroidCount === 0) {
      const asteroidCount = data.asteroidCount || 10;
      const asteroids = this.gameEngine.createAsteroids(asteroidCount);
      this.broadcaster.broadcastAsteroidCreation(asteroids);
      logger.debug(`Player ${id} triggered server asteroid creation: ${asteroidCount} asteroids`);
    } else {
      // Asteroids already exist, just send them to the requesting player
      const existingAsteroids = this.gameEngine.getAllAsteroids();
      this.broadcaster.sendToWebSocket(ws, {
        type: 'asteroidCreateBatch',
        asteroids: existingAsteroids,
        timestamp: Date.now(),
      });
      logger.debug(`Player ${id} requested asteroid initialization - sent existing ${currentAsteroidCount} asteroids`);
    }
  }

  private handleAsteroidUpdate(ws: WebSocket, data: any): void {
    if (!data.asteroidId || !data.updates) {
      this.broadcaster.sendError(ws, 'Missing asteroid ID or updates for asteroidUpdate');
      return;
    }

    this.gameEngine.updateAsteroid(data.asteroidId, data.updates);
    this.broadcaster.broadcastAsteroidUpdate(data.asteroidId, data.updates);
  }

  private handleAsteroidDestroy(ws: WebSocket, data: any): void {
    if (!data.asteroidId) {
      this.broadcaster.sendError(ws, 'Missing asteroid ID for asteroidDestroy');
      return;
    }

    this.gameEngine.removeAsteroid(data.asteroidId);
    this.broadcaster.broadcastAsteroidDestruction(data.asteroidId);
  }

  private sendBotStateToSocket(ws: WebSocket, bot: ServerBot): void {
    this.broadcaster.sendToWebSocket(ws, {
      type: 'botCreated',
      data: {
        botId: bot.id,
        botName: bot.name,
        position: bot.position,
      },
      timestamp: Date.now(),
    });

    this.broadcaster.sendToWebSocket(ws, {
      type: 'botUpdate',
      data: {
        botId: bot.id,
        playerId: 'server',
        position: bot.position,
        velocity: bot.velocity,
        angle: bot.angle,
        exploding: bot.exploding,
        lives: bot.lives,
        health: bot.health,
        maxHealth: bot.maxHealth,
      },
      timestamp: Date.now(),
    });
  }

  private handleInitBots(ws: WebSocket, id: string, data: any): void {
    if (!id) {
      this.broadcaster.sendError(ws, 'Missing player ID for initBots');
      return;
    }

    const botCount = Math.min(data.botCount || 1, 10);
    const bots = this.gameEngine.createBots(botCount);

    if (bots) {
      this.broadcaster.broadcastBotCreation(bots);
      logger.debug(`Player ${id} triggered server bot creation: ${botCount} bots`);

      // Send current bot state to the requesting player
      for (const bot of bots) {
        this.sendBotStateToSocket(ws, bot);
      }
    } else {
      logger.debug(`Player ${id} requested bot initialization but bots already exist or creation in progress`);

      // Send current bot state if bots already exist
      const existingBots = this.gameEngine.getAllBots();
      for (const bot of existingBots) {
        this.sendBotStateToSocket(ws, bot);
      }
    }
  }

  private handleBotUpdate(ws: WebSocket, data: any): void {
    if (!data.botId || !data.playerId) {
      this.broadcaster.sendError(ws, 'Missing bot ID or player ID for botUpdate');
      return;
    }

    // For now, only server-owned bots can be updated through this message
    // Client-owned bots should be handled differently
    if (data.playerId !== 'server') {
      this.broadcaster.sendError(ws, 'Only server-owned bots can be updated through this endpoint');
      return;
    }

    // Update bot through broadcaster (for client-owned bots)
    this.broadcaster.broadcastBotUpdate(data.botId);
  }

  private handleBotDestroyed(ws: WebSocket, data: any): void {
    if (!data.botId) {
      this.broadcaster.sendError(ws, 'Missing bot ID for botDestroyed');
      return;
    }

    this.gameEngine.removeBot(data.botId);
    this.broadcaster.broadcastBotDestroyed(data.botId);
  }

  private handleClientLog(data: any): void {
    ClientLogger.logClientMessage(data);
  }

  private handlePing(ws: WebSocket): void {
    this.broadcaster.sendToWebSocket(ws, { type: 'pong', timestamp: Date.now() });
  }
}
