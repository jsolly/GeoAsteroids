import { WebSocket } from 'ws';
import { logger } from '../setup/serverLogger';
import type { Position, Velocity, AsteroidData } from '../shared-types';

// Player management
export interface ConnectedPlayer {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  rotation: number;
  angularVelocity: number;
  lives: number;
  score: number;
  exploding: boolean;
  health?: number;
  maxHealth?: number;
  lastUpdate: number;
  ws: WebSocket;
}

export interface ServerBot {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  lives: number;
  health: number;
  maxHealth: number;
  lastUpdate: number;
}

export class WebSocketCore {
  private players = new Map<string, ConnectedPlayer>();
  private asteroids = new Map<string, AsteroidData>();
  private bots = new Map<string, ServerBot>();
  private gameTime = 0;

  constructor() {
    // Start game loop for cleanup (10 FPS)
    setInterval(() => {
      this.gameTime++;
      this.cleanupStalePlayers();
    }, 100);
  }

  private cleanupStalePlayers(): void {
    // Clean up stale players (haven't updated in 30 seconds)
    const now = Date.now();
    for (const [id, player] of this.players.entries()) {
      if (now - player.lastUpdate > 30000) {
        logger.debug(`🧹 Cleaning up stale player ${player.name} (${id})`);
        this.removePlayer(id);
      }
    }
  }

  public addPlayer(id: string, name: string, ws: WebSocket, position?: Position): void {
    const player: ConnectedPlayer = {
      id,
      name,
      position: position || { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      angularVelocity: 0,
      lives: 3,
      score: 0,
      exploding: false,
      health: 100,
      maxHealth: 100,
      lastUpdate: Date.now(),
      ws,
    };

    this.players.set(id, player);
    logger.info(`👤 Player ${name} (${id}) added`);
  }

  public removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      logger.info(`👋 Player ${player.name} (${id}) removed`);
      this.players.delete(id);
    }
  }

  public updatePlayer(id: string, data: any): void {
    const player = this.players.get(id);
    if (player) {
      // Use Object.assign for efficient bulk assignment
      const updates: Partial<ConnectedPlayer> = {};
      
      if (data.position) updates.position = data.position;
      if (data.velocity) updates.velocity = data.velocity;
      if (data.rotation !== undefined) updates.rotation = data.rotation;
      if (data.angularVelocity !== undefined) updates.angularVelocity = data.angularVelocity;
      if (data.lives !== undefined) updates.lives = data.lives;
      if (data.score !== undefined) updates.score = data.score;
      if (data.exploding !== undefined) updates.exploding = data.exploding;
      if (data.health !== undefined) updates.health = data.health;
      if (data.maxHealth !== undefined) updates.maxHealth = data.maxHealth;
      
      // Backward compatibility for old a property (r is ship radius, not player rotation)
      if (data.a !== undefined) updates.angularVelocity = data.a;
      
      Object.assign(player, updates);
      player.lastUpdate = Date.now();
    }
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getPlayer(id: string): ConnectedPlayer | undefined {
    return this.players.get(id);
  }

  public getAllPlayers(): ConnectedPlayer[] {
    return Array.from(this.players.values());
  }

  // Asteroid management
  public addAsteroid(asteroid: AsteroidData): void {
    this.asteroids.set(asteroid.id, asteroid);
    logger.debug(`🪨 Asteroid ${asteroid.id} added`);
  }

  public removeAsteroid(asteroidId: string): void {
    if (this.asteroids.delete(asteroidId)) {
      logger.debug(`🪨 Asteroid ${asteroidId} removed`);
    }
  }

  public updateAsteroid(asteroidId: string, updates: Partial<AsteroidData>): void {
    const asteroid = this.asteroids.get(asteroidId);
    if (asteroid) {
      Object.assign(asteroid, updates);
    }
  }

  public getAllAsteroids(): AsteroidData[] {
    return Array.from(this.asteroids.values());
  }

  public clearAsteroids(): void {
    this.asteroids.clear();
    logger.debug('🧹 All asteroids cleared');
  }

  // Server-authoritative asteroid creation
  public createAsteroids(count: number): void {
    // Clear existing asteroids
    this.asteroids.clear();

    // Create new asteroids with deterministic IDs
    for (let i = 0; i < count; i++) {
      const asteroidId = `server-asteroid-${i}`;
      const asteroid: AsteroidData = {
        id: asteroidId,
        position: {
          x: Math.random() * 2000 - 1000, // Random position between -1000 and 1000
          y: Math.random() * 2000 - 1000
        },
        velocity: {
          x: (Math.random() - 0.5) * 4, // Random velocity between -2 and 2
          y: (Math.random() - 0.5) * 4
        },
        size: Math.random() * 40 + 20, // Size between 20 and 60
        jaggedness: Math.random() * 0.5 + 0.5, // Jaggedness between 0.5 and 1.0
        rotation: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 2, // Angular velocity between -1 and 1
        health: Math.floor(Math.random() * 50) + 20, // Health between 20 and 70
        maxHealth: Math.floor(Math.random() * 50) + 20
      };

      this.asteroids.set(asteroidId, asteroid);
      logger.debug(`🪨 Server asteroid created: ${asteroidId} (size: ${asteroid.size})`);
    }

    // Broadcast asteroid creation to all players
    this.broadcastAsteroidCreation();
  }

  private broadcastAsteroidCreation(): void {
    for (const asteroid of this.asteroids.values()) {
      this.broadcastToAll({
        type: 'asteroidCreate',
        data: { asteroid },
        timestamp: Date.now()
      });
    }
  }

  private broadcastScoreUpdate(playerId: string, score: number): void {
    this.broadcastToAll({
      type: 'scoreUpdate',
      data: {
        playerId: playerId,
        score: score
      },
      timestamp: Date.now()
    });
  }

  // Bot management
  public createBots(count: number): void {
    // Clear existing bots
    this.bots.clear();

    // Create new bots with deterministic IDs based on count
    const botNames = [
      'Crimson Falcon', 'Nebula Viper', 'Quantum Ranger', 'Cosmic Specter',
      'Lunar Guardian', 'Solar Sentinel', 'Galactic Hunter', 'Star Warden',
      'Nova Enforcer', 'Meteor Striker'
    ];

    for (let i = 0; i < count && i < botNames.length; i++) {
      const botId = `server-bot-${i}`;
      const bot: ServerBot = {
        id: botId,
        name: botNames[i],
        position: {
          x: Math.random() * 2000 - 1000, // Random position between -1000 and 1000
          y: Math.random() * 2000 - 1000
        },
        velocity: { x: 0, y: 0 },
        angle: Math.random() * Math.PI * 2,
        exploding: false,
        lives: 3,
        health: 100,
        maxHealth: 100,
        lastUpdate: Date.now()
      };

      this.bots.set(botId, bot);
      logger.debug(`🤖 Server bot created: ${bot.name} (${botId})`);
    }

    // Broadcast bot creation to all players
    this.broadcastBotCreation();
  }

  public getAllBots(): ServerBot[] {
    return Array.from(this.bots.values());
  }

  public updateBot(botId: string, updates: Partial<ServerBot>): void {
    const bot = this.bots.get(botId);
    if (bot) {
      Object.assign(bot, updates);
      bot.lastUpdate = Date.now();
    }
  }

  public damageBot(botId: string, damage: number): void {
    const bot = this.bots.get(botId);
    if (bot && !bot.exploding) {
      bot.health = Math.max(0, bot.health - damage);
      bot.lastUpdate = Date.now();

      if (bot.health <= 0) {
        bot.exploding = true;
        logger.debug(`🤖 Bot destroyed by damage: ${bot.name} (${botId})`);
      }

      // Broadcast bot damage to all players
      this.broadcastBotUpdate(botId);
    }
  }

  private broadcastBotCreation(): void {
    for (const bot of this.bots.values()) {
      this.broadcastToAll({
        type: 'botCreated',
        data: {
          botId: bot.id,
          botName: bot.name,
          position: bot.position
        },
        timestamp: Date.now()
      });
    }
  }

  private broadcastBotUpdate(botId: string): void {
    const bot = this.bots.get(botId);
    if (bot) {
      this.broadcastToAll({
        type: 'botUpdate',
        data: {
          botId: bot.id,
          playerId: 'server', // Server-owned bots
          position: bot.position,
          velocity: bot.velocity,
          angle: bot.angle,
          exploding: bot.exploding,
          lives: bot.lives,
          health: bot.health,
          maxHealth: bot.maxHealth
        },
        timestamp: Date.now()
      });
    }
  }

  public broadcastToAll(message: any, excludeId?: string): void {
    const messageStr = JSON.stringify(message);
    for (const [id, player] of this.players.entries()) {
      if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    }
  }

  public sendToWebSocket(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public sendError(ws: WebSocket, message: string): void {
    this.sendToWebSocket(ws, { type: 'error', data: message, timestamp: Date.now() });
  }

  public handleClientMessage(message: any, ws: WebSocket): void {
    // Accept both top-level fields and nested data payloads for compatibility
    const type = message.type;
    const payload = typeof message.data === 'object' && message.data !== null ? message.data : {};
    const id = message.id ?? payload.id;
    const name = message.name ?? payload.name;
    const restData = { ...payload, ...message };
    delete (restData as any).type;
    delete (restData as any).data;
    delete (restData as any).id;
    delete (restData as any).name;



    switch (type) {
      case 'join':
        if (!id || !name) {
          this.sendError(ws, 'Missing player ID or name');
          return;
        }
        
        // Handle position if provided by client
        const joinPosition = this.validatePosition(restData.position) || { x: 0, y: 0 };
        
        this.addPlayer(id as string, name as string, ws, joinPosition);

        // Send confirmation to the joining player
        this.sendToWebSocket(ws, {
          type: 'joined',
          id,
          name,
          position: joinPosition,
        });

        // Broadcast to all other players
        this.broadcastToAll(
          {
            type: 'playerJoined',
            id,
            name,
            position: joinPosition,
          },
          id as string
        );
        this.broadcastGameState();
        break;

      case 'initBots':
        // Handle bot initialization - create server-managed bots
        if (!id) {
          this.sendError(ws, 'Missing player ID for initBots');
          return;
        }

        // Only create bots if they don't already exist (first player to request)
        if (this.bots.size === 0) {
          const botCount = Math.min(restData.botCount || 1, 10); // Max 10 bots
          this.createBots(botCount);
          logger.debug(`Player ${id} triggered server bot creation: ${botCount} bots`);
        } else {
          logger.debug(`Player ${id} requested bot initialization but bots already exist: ${this.bots.size} bots`);
        }

        // Send current bot state to the requesting player
        for (const bot of this.bots.values()) {
          this.sendToWebSocket(ws, {
            type: 'botCreated',
            data: {
              botId: bot.id,
              botName: bot.name,
              position: bot.position
            },
            timestamp: Date.now()
          });

          // Also send current state
          this.sendToWebSocket(ws, {
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
              maxHealth: bot.maxHealth
            },
            timestamp: Date.now()
          });
        }
        break;

      case 'botUpdate':
        // Handle bot state updates
        if (!restData.botId || !restData.playerId) {
          this.sendError(ws, 'Missing bot ID or player ID for botUpdate');
          return;
        }
        // Broadcast bot update to all other players
        this.broadcastToAll({
          type: 'botUpdate',
          data: restData,
          timestamp: Date.now()
        }, restData.playerId);
        break;

      case 'botDestroyed':
        // Handle bot destruction
        if (!restData.botId) {
          this.sendError(ws, 'Missing bot ID for botDestroyed');
          return;
        }
        // Broadcast bot destruction to all players
        this.broadcastToAll({
          type: 'botDestroyed',
          data: { botId: restData.botId },
          timestamp: Date.now()
        });
        break;

      case 'update':
        if (!id) {
          this.sendError(ws, 'Missing player ID');
          return;
        }
        // Direct assignment - no conversion needed since we use plain objects
        
        this.updatePlayer(id as string, restData);
        // Include laser data if provided
        const updateData: any = { id, ...restData };
        if (restData.lasers !== undefined) {
          updateData.lasers = restData.lasers;
        }
        if (restData.health !== undefined) {
          updateData.health = restData.health;
        }
        if (restData.maxHealth !== undefined) {
          updateData.maxHealth = restData.maxHealth;
        }
        this.broadcastToAll(
          { type: 'playerUpdate', data: updateData, timestamp: Date.now() },
          id as string
        );
        break;

      case 'chat': {
        if (!id || !restData.message) {
          this.sendError(ws, 'Missing player ID or message');
          return;
        }
        const player = this.getPlayer(id as string);
        if (player) {
          this.broadcastToAll({
            type: 'chat',
            data: {
              id,
              name: player.name,
              message: restData.message,
            },
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'shoot':
        if (!id) {
          this.sendError(ws, 'Missing player ID for shoot');
          return;
        }
        // Broadcast shooting event to all other players
        const shootData = {
          id,
          laserStart: restData.laserStart,
          laserDirection: restData.laserDirection,
          timestamp: Date.now()
        };
        this.broadcastToAll(
          { type: 'playerShoot', data: shootData, timestamp: Date.now() },
          id as string
        );
        break;

      case 'laserDamage':
        if (!restData.targetPlayerId || !restData.attackerId || restData.damage === undefined) {
          this.sendError(ws, 'Missing required fields for laserDamage');
          return;
        }
        // Apply damage to the target player and broadcast the damage event
        const targetPlayer = this.players.get(restData.targetPlayerId);
        const attackerPlayer = this.players.get(restData.attackerId);

        if (targetPlayer) {
          // Ensure player has health initialized
          if (targetPlayer.health === undefined) {
            targetPlayer.health = 100; // Default health
          }

          const wasAlive = targetPlayer.health > 0;
          // Apply damage to the player's health
          targetPlayer.health = Math.max(0, targetPlayer.health - restData.damage);

          // If player is destroyed, set exploding state and award points
          if (targetPlayer.health <= 0 && wasAlive) {
            targetPlayer.exploding = true;
            // Award points to the attacker for destroying a player
            if (attackerPlayer) {
              attackerPlayer.score += 200;
              logger.debug(`Player ${attackerPlayer.name} scored 200 points for destroying ${targetPlayer.name}`);
              // Broadcast score update to all players
              this.broadcastScoreUpdate(attackerPlayer.id, attackerPlayer.score);
            }
          }

          // Broadcast damage event to all players
          this.broadcastToAll({
            type: 'playerDamaged',
            data: {
              targetPlayerId: restData.targetPlayerId,
              attackerId: restData.attackerId,
              damage: restData.damage,
              remainingHealth: targetPlayer.health,
              isDestroyed: targetPlayer.health <= 0 && wasAlive
            },
            timestamp: Date.now()
          });
        }
        break;

      case 'botDamage':
        if (!restData.botId || !restData.attackerId || restData.damage === undefined) {
          this.sendError(ws, 'Missing required fields for botDamage');
          return;
        }

        // Apply damage to server-managed bot
        const bot = this.bots.get(restData.botId);
        const botAttackerPlayer = this.players.get(restData.attackerId);

        if (bot) {
          const wasAlive = bot.health > 0;
          bot.health = Math.max(0, bot.health - restData.damage);

          // If bot is destroyed, award points to attacker
          if (bot.health <= 0 && wasAlive) {
            bot.exploding = true;
            if (botAttackerPlayer) {
              botAttackerPlayer.score += 50; // 50 points for destroying a bot
              logger.debug(`Player ${botAttackerPlayer.name} scored 50 points for destroying bot ${bot.name}`);
              // Broadcast score update to all players
              this.broadcastScoreUpdate(botAttackerPlayer.id, botAttackerPlayer.score);
            }
          }

          // Broadcast bot damage (already handled by damageBot method)
          this.damageBot(restData.botId, restData.damage);
        }

        logger.debug('Bot damage applied', {
          botId: restData.botId,
          attackerId: restData.attackerId,
          damage: restData.damage
        });
        break;

      case 'asteroidDestroyed':
        if (!restData.asteroidId || !restData.playerId || restData.points === undefined) {
          this.sendError(ws, 'Missing required fields for asteroidDestroyed');
          return;
        }

        // Remove the asteroid from server state
        const asteroid = this.asteroids.get(restData.asteroidId);
        if (asteroid) {
          this.asteroids.delete(restData.asteroidId);

          // Award points to the player
          const player = this.players.get(restData.playerId);
          if (player) {
            player.score += restData.points;
            logger.debug(`Player ${player.name} scored ${restData.points} points for destroying asteroid`);
            // Broadcast score update to all players
            this.broadcastScoreUpdate(player.id, player.score);
          }

          // Broadcast asteroid destruction to all players
          this.broadcastToAll({
            type: 'asteroidDestroy',
            data: { asteroidId: restData.asteroidId },
            timestamp: Date.now()
          });
        }
        break;

      case 'initAsteroids':
        // Handle asteroid initialization - create server-managed asteroids
        if (!id) {
          this.sendError(ws, 'Missing player ID for initAsteroids');
          return;
        }

        // Only create asteroids if they don't already exist (first player to request)
        if (this.asteroids.size === 0) {
          const asteroidCount = Math.min(restData.asteroidCount || 10, 20); // Max 20 asteroids
          this.createAsteroids(asteroidCount);
          logger.debug(`Player ${id} triggered server asteroid creation: ${asteroidCount} asteroids`);
        } else {
          logger.debug(`Player ${id} requested asteroid initialization but asteroids already exist: ${this.asteroids.size} asteroids`);
        }

        // Send current asteroid state to the requesting player
        for (const asteroid of this.asteroids.values()) {
          this.sendToWebSocket(ws, {
            type: 'asteroidCreate',
            data: { asteroid },
            timestamp: Date.now()
          });
        }
        break;

      case 'asteroidCreate':
        // Server-authoritative: Only accept asteroid creation from server itself
        // Client requests should use 'initAsteroids' instead
        if (!restData.asteroid) {
          this.sendError(ws, 'Missing asteroid data for asteroidCreate');
          return;
        }

        // For server-authoritative system, only the server should create asteroids
        // Client requests should use initAsteroids message instead
        this.sendError(ws, 'Clients cannot create asteroids directly. Use initAsteroids message.');
        break;

      case 'asteroidUpdate':
        if (!restData.asteroidId || !restData.updates) {
          this.sendError(ws, 'Missing asteroid ID or updates for asteroidUpdate');
          return;
        }
        this.updateAsteroid(restData.asteroidId, restData.updates);
        // Broadcast asteroid update to all players
        this.broadcastToAll({
          type: 'asteroidUpdate',
          data: { asteroidId: restData.asteroidId, updates: restData.updates },
          timestamp: Date.now()
        });
        break;

      case 'asteroidDestroy':
        if (!restData.asteroidId) {
          this.sendError(ws, 'Missing asteroid ID for asteroidDestroy');
          return;
        }
        this.removeAsteroid(restData.asteroidId);
        // Broadcast asteroid destruction to all players
        this.broadcastToAll({
          type: 'asteroidDestroy',
          data: { asteroidId: restData.asteroidId },
          timestamp: Date.now()
        });
        break;

      case 'ping':
        this.sendToWebSocket(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        logger.warn(`Unknown message type: ${type}`);
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  public broadcastGameState(): void {
    const gameState = {
      type: 'gameState',
      data: {
        players: Array.from(this.players.values()).map(
                  ({ id, name, position, velocity, rotation, angularVelocity, lives, score, exploding, health, maxHealth }) => ({
          id,
          name,
          position,
          velocity: velocity ?? { x: 0, y: 0 },
          rotation: rotation ?? 0,
          angularVelocity: angularVelocity ?? 0, // angular velocity, default to 0
          lives: lives ?? 3,
          score,
          exploding: exploding ?? false,
          health: health ?? 100,
          maxHealth: maxHealth ?? 100,
        })
        ),
        asteroids: this.getAllAsteroids(),
        gameTime: this.gameTime,
      },
      timestamp: Date.now(),
    };
    this.broadcastToAll(gameState);
  }

  public startPeriodicGameStateBroadcast(): void {
    // Periodic game state broadcast (5 FPS)
    setInterval(() => {
      if (this.players.size > 0) {
        this.broadcastGameState();
      }
    }, 200);
  }

  private validatePosition(position: any): { x: number; y: number } | null {
    if (!position || typeof position !== 'object') {
      return null;
    }

    const x = typeof position.x === 'number' ? position.x : (typeof position.x === 'string' ? parseFloat(position.x) : NaN);
    const y = typeof position.y === 'number' ? position.y : (typeof position.y === 'string' ? parseFloat(position.y) : NaN);

    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
      return null;
    }

    return { x, y };
  }
}
