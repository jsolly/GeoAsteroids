import { WebSocket } from 'ws';
import { GameEngine } from '../core/GameEngine';
import { GameStateBroadcaster } from '../services/GameStateBroadcaster';
import { ClientLogger } from '../services/ClientLogger';
import { logger } from '../../setup/serverLogger';
import { DAMAGE, DEBUG } from '../../src/constants';
import {
  clampLaserDamage,
  isAllowedLaserReporter,
  isClientOwnedCollisionAttacker,
  isServerOwnedRamAttacker,
} from '../../shared/combat';
import { isStaleDeathPose, type GameEntity } from '../core/EntityManager';

const PAYLOAD_PREVIEW_MAX_CHARS = 500;

function boundedPayloadPreview(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  let serialized: string;
  try {
    serialized = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    serialized = String(value);
  }
  if (serialized.length <= PAYLOAD_PREVIEW_MAX_CHARS) {
    return serialized;
  }
  return `${serialized.slice(0, PAYLOAD_PREVIEW_MAX_CHARS)}…`;
}

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
    
    // Debug logging for join messages
    if (type === 'join') {
      console.log('🔌 SERVER: Raw message:', JSON.stringify(message, null, 2));
      console.log('🔌 SERVER: Message keys:', Object.keys(message));
      console.log('🔌 SERVER: Message.data type:', typeof message.data);
      console.log('🔌 SERVER: Message.data value:', message.data);
      console.log('🔌 SERVER: Payload:', JSON.stringify(payload, null, 2));
      console.log('🔌 SERVER: RestData before processing:', JSON.stringify(restData, null, 2));
    }
    
    // Don't delete data field for clientLog and join messages as they need the nested structure
    if (type !== 'clientLog' && type !== 'join') {
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
      logger.error('Error handling message', {
        messageType: type ?? '<missing>',
        messageId: id ?? '<missing>',
        payloadPreview: boundedPayloadPreview(restData),
      }, error);
      this.broadcaster.sendError(ws, 'Internal server error');
    }
  }

  private handleJoin(ws: WebSocket, id: string, name: string, data: any): void {
    logger.debug('🔌 Handling join message', { id, name, data });
    console.log('🔌 SERVER: Handling join message', { id, name, data });
    console.log('🔌 SERVER: Data details:', {
      name: data.name,
      color: data.color,
      position: data.position
    });
    
    if (!id || !name) {
      logger.warn('❌ Missing player ID or name for join', { id, name });
      this.broadcaster.sendError(ws, 'Missing player ID or name');
      return;
    }

    // Handle position if provided by client
    console.log('🔌 SERVER: Raw position from client:', data.position);
    console.log('🔌 SERVER: Position type:', typeof data.position);
    console.log('🔌 SERVER: Position keys:', data.position ? Object.keys(data.position) : 'null');
    const validatedPosition = this.gameEngine.validatePosition(data.position);
    console.log('🔌 SERVER: Validated position:', validatedPosition);
    const joinPosition = validatedPosition || { x: 0, y: 0 };
    const joinColor = data.color || '#00ff00'; // Default to green if no color provided
    console.log('🔌 SERVER: Final position:', joinPosition);
    logger.debug('📍 Player join position', { id, position: joinPosition });
    logger.debug('🎨 Player join color', { id, color: joinColor });

    this.gameEngine.addPlayer(id, name, ws, joinPosition, joinColor);
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

    // Ignore movement updates while the player is dead, exploding, or waiting to
    // respawn. Otherwise the client's stale position keeps overwriting the
    // server-chosen respawn position, leaving the ship frozen where it died
    // (e.g. stuck outside the boundary at full health).
    const existing = this.gameEngine.getPlayer(id);
    if (existing && (existing.exploding || existing.respawnTimer !== undefined || existing.health <= 0)) {
      return;
    }

    // Hold the server spawn point until the client echoes a nearby transform.
    // The instant respawn clears dead/exploding flags, a stale death-pose
    // update would otherwise teleport the ship back onto the wall/roid.
    if (existing && isStaleDeathPose(existing.respawnAnchor, data.position)) {
      return;
    }
    if (existing?.respawnAnchor && data.position) {
      existing.respawnAnchor = undefined;
    }

    // Server-authoritative fields: the client only mirrors these back from our
    // own broadcasts, so accepting them lets a stale client value clobber the
    // authoritative state (e.g. a freshly-awarded score getting reset to 0).
    const sanitizedData: any = { ...data };
    delete (sanitizedData as any).health;
    delete (sanitizedData as any).maxHealth;
    delete (sanitizedData as any).score;
    delete (sanitizedData as any).lives;
    delete (sanitizedData as any).respawnTimer;
    delete (sanitizedData as any).spawnProtectionTimer;

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
    logger.debug('DEBUG: Server received shoot message', { id, data });
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

  private getReporterId(ws: WebSocket): string | undefined {
    return this.gameEngine.entityManager.getHumanBySocket(ws)?.id;
  }

  private emitShipDamage(
    targetId: string,
    attackerId: string,
    damage: number,
    healthBefore: number | undefined
  ): void {
    const outcome = this.gameEngine.handleShipDamage(targetId, attackerId, damage);
    if (!outcome.applied || !outcome.entity) {
      return;
    }
    const healthDropped =
      healthBefore !== undefined && outcome.entity.health < healthBefore;
    if (!outcome.isDestroyed && !healthDropped) {
      return;
    }
    this.broadcaster.broadcastCombatResult({
      targetId,
      attackerId,
      damage,
      remainingHealth: outcome.entity.health,
      remainingLives: outcome.entity.lives,
      isDestroyed: outcome.isDestroyed,
      targetType: outcome.entity.type,
      targetName: outcome.entity.name,
      awardedScore: outcome.isDestroyed
        ? (() => {
            const attacker = this.gameEngine.entityManager.getEntity(attackerId);
            return attacker ? { playerId: attackerId, score: attacker.score } : undefined;
          })()
        : undefined,
    });
  }

  private handleLaserDamage(ws: WebSocket, data: any): void {
    if (!data.targetPlayerId || !data.attackerId || data.damage === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for laserDamage');
      return;
    }

    const reporterId = this.getReporterId(ws);
    if (!reporterId || !isAllowedLaserReporter(reporterId, data.attackerId, data.targetPlayerId)) {
      return;
    }

    const damage = clampLaserDamage(data.damage);
    if (damage <= 0) {
      return;
    }

    const before = this.gameEngine.entityManager.getEntity(data.targetPlayerId);
    this.emitShipDamage(data.targetPlayerId, data.attackerId, damage, before?.health);
  }

  private handleCollisionDamage(ws: WebSocket, data: any): void {
    if (!data.targetPlayerId || !data.attackerId || data.damage === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for collisionDamage');
      return;
    }

    // Ship↔asteroid and ship↔ship are resolved in the server game loop.
    if (!isClientOwnedCollisionAttacker(data.attackerId)) {
      return;
    }

    const reporterId = this.getReporterId(ws);
    if (!reporterId || reporterId !== data.targetPlayerId) {
      return;
    }

    const before = this.gameEngine.getPlayer(data.targetPlayerId);
    this.emitShipDamage(
      data.targetPlayerId,
      'boundary',
      DAMAGE.BOUNDARY_COLLISION,
      before?.health
    );
  }

  private handleBotDamage(ws: WebSocket, data: any): void {
    if (!data.botId || !data.attackerId || data.damage === undefined) {
      this.broadcaster.sendError(ws, 'Missing required fields for botDamage');
      return;
    }

    if (isServerOwnedRamAttacker(data.attackerId)) {
      return;
    }

    const reporterId = this.getReporterId(ws);
    if (!reporterId || (reporterId !== data.attackerId && reporterId !== data.botId)) {
      return;
    }

    const before = this.gameEngine.getBot(data.botId);
    this.emitShipDamage(data.botId, data.attackerId, data.damage, before?.health);
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
    console.log('🪨 SERVER: Handling initAsteroids message', { id, data });
    if (!id) {
      this.broadcaster.sendError(ws, 'Missing player ID for initAsteroids');
      return;
    }

    const currentAsteroidCount = this.gameEngine.getAsteroidCount();
    
    // Always create new asteroids in test mode, or if no asteroids exist
    const isTestMode = DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER;
    logger.debug('Asteroid creation check:', { currentAsteroidCount, isTestMode, shouldCreate: currentAsteroidCount === 0 || isTestMode, DEBUG_AVAILABLE: !!DEBUG });
    if (currentAsteroidCount === 0 || isTestMode) {
      const asteroidCount = data.asteroidCount || 10;
      
      // Get current entity positions for roid placement
      const allEntities = this.gameEngine.entityManager.getAllEntities();
      const humanPlayers = allEntities.filter(entity => entity.type === 'human');
      const bots = allEntities.filter(entity => entity.type === 'bot');
      
      console.log('🪨 SERVER: Available entities for asteroid placement:', {
        allEntities: allEntities.length,
        humanPlayers: humanPlayers.length,
        bots: bots.length,
        humanPlayerPositions: humanPlayers.map(p => p.position),
        botPositions: bots.map(b => b.position)
      });
      
      const playerPositions = humanPlayers.map(player => player.position);
      const botPositions = bots.map(bot => bot.position);
      
      const asteroids = this.gameEngine.createAsteroids(asteroidCount, { radius: 3100 }, botPositions, playerPositions);
      this.broadcaster.broadcastAsteroidCreation(asteroids);
      logger.debug(`Player ${id} triggered server asteroid creation: ${asteroidCount} asteroids with ${playerPositions.length} player positions and ${botPositions.length} bot positions`);
    } else {
      // Asteroids already exist, just send them to the requesting player
      const existingAsteroids = this.gameEngine.getAllAsteroids();
      this.broadcaster.sendToWebSocket(ws, {
        type: 'asteroidCreateBatch',
        data: {
          asteroids: existingAsteroids,
        },
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

  private sendBotStateToSocket(ws: WebSocket, bot: GameEntity): void {
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
      const existingBots = this.gameEngine.entityManager.getBots();
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
