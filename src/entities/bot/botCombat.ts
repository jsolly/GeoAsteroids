import { v4 as uuidv4 } from 'uuid';
import { FPS, getCVS, LASER_DIST, LASER_SPEED } from '../../constants';
import { Vector } from '../../physics/Vector.ts';
import { Laser } from '../ship/Ship.ts';
import type { BotBullet, BotPlayer, BotShoot } from './types.ts';

export class BotCombat {
  private botBullets: Map<string, BotBullet> = new Map();
  private botLasers: Map<string, Laser[]> = new Map();
  private localPlayerId: string;
  private localPlayerPosition: Vector = new Vector(0, 0);
  private localPlayerAlive: boolean = true;
  private botShootCallback?: (botShoot: BotShoot) => void;

  constructor() {
    this.localPlayerId = uuidv4();
  }

  public setLocalPlayerInfo(id: string, position: Vector, alive: boolean): void {
    this.localPlayerId = id;
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;
  }

  public setBotShootCallback(callback: (botShoot: BotShoot) => void): void {
    this.botShootCallback = callback;
  }

  public getBotBullets(): Map<string, BotBullet> {
    return this.botBullets;
  }

  public getBotLasers(): Map<string, Laser[]> {
    return this.botLasers;
  }

  public createBotBullet(botShoot: BotShoot): void {
    const bulletId = `bullet-${uuidv4()}`;
    const bullet: BotBullet = {
      id: bulletId,
      botId: botShoot.botId,
      position: new Vector(botShoot.laserStart.x, botShoot.laserStart.y),
      direction: new Vector(botShoot.laserDirection.x, botShoot.laserDirection.y),
      speed: 8,
      distanceTraveled: 0,
      maxDistance: 800,
      createdAt: Date.now(),
    };

    this.botBullets.set(bulletId, bullet);
    console.info('BOT_BULLET', 'Bot bullet created (compat shim)', {
      bulletId,
      botId: botShoot.botId,
      totalBullets: this.botBullets.size,
    });
  }

  public createBotLaser(botShoot: BotShoot): void {
    const start = new Vector(botShoot.laserStart.x, botShoot.laserStart.y);
    const direction = new Vector(botShoot.laserDirection.x, botShoot.laserDirection.y);

    // Match player laser physics
    const baseVelocity = direction.multiply(LASER_SPEED / FPS);
    const velocity = baseVelocity;

    const laser = new Laser(start, velocity, 0, 0);
    const lasers = this.botLasers.get(botShoot.botId) || [];
    lasers.push(laser);
    this.botLasers.set(botShoot.botId, lasers);

    console.info('BOT_LASER', 'Bot laser created', {
      botId: botShoot.botId,
      startPos: { x: start.x, y: start.y },
      velocity: { x: velocity.x, y: velocity.y },
      lasersForBot: lasers.length,
    });
  }

  public updateBotBullets(): void {
    // Legacy no-op retained for compatibility; lasers are now the projectile system
    this.updateBotLasers();
  }

  public updateBotLasers(): void {
    if (this.botLasers.size === 0) {
      return;
    }

    const cvs = getCVS();

    for (const [botId, lasers] of this.botLasers.entries()) {
      for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];

        if (laser.explodeTime > 0) {
          laser.explodeTime--;
          if (laser.explodeTime === 0) {
            lasers.splice(i, 1);
            continue;
          }
        } else {
          laser.position = laser.position.add(laser.velocity);
          laser.distTraveled += laser.velocity.magnitude();
        }

        // Match player removal logic
        if (cvs && laser.distTraveled >= LASER_DIST + cvs.width) {
          lasers.splice(i, 1);
        }
      }

      if (lasers.length === 0) {
        this.botLasers.delete(botId);
      } else {
        this.botLasers.set(botId, lasers);
      }
    }
  }

  public clearBotBullets(): void {
    this.botBullets.clear();
    console.info('BOT_COMBAT', 'All bot bullets cleared');
  }

  public clearBotLasers(): void {
    this.botLasers.clear();
    console.info('BOT_COMBAT', 'All bot lasers cleared');
  }

  public updateBotShooting(bots: Map<string, BotPlayer>): void {
    const now = Date.now();

    // Log that shooting update is running (occasionally)
    if (Math.random() < 0.01) {
      console.info('BOT_SHOOTING_UPDATE', 'Bot shooting update running', {
        botCount: bots.size,
        activeBots: Array.from(bots.values()).filter((bot) => !bot.ship.exploding).length,
        localPlayerAlive: this.localPlayerAlive,
      });
    }

    for (const [, bot] of bots.entries()) {
      // Skip dead bots and bots that are exploding
      if (bot.ship.exploding) {
        continue;
      }
      if (!this.localPlayerAlive) {
        continue;
      }

      // Check if bot can shoot
      if (now - bot.ship.lastShotTime < bot.ship.shotCooldown) {
        continue;
      }

      // Check if player is in range and line of sight
      if (this.canBotShootAtPlayer(bot)) {
        this.botShoot(bot);
        bot.ship.lastShotTime = now;

        console.info('BOT_SHOOTING', 'Bot successfully shot at player', {
          botId: bot.id,
          name: bot.name,
          botType: bot.botType,
          distance: this.getDistanceToPlayer(bot.ship.position),
          botFacing: Math.round((bot.ship.a * 180) / Math.PI),
          angleToPlayer: Math.round(
            (Math.atan2(
              -(this.localPlayerPosition.y - bot.ship.position.y),
              this.localPlayerPosition.x - bot.ship.position.x
            ) *
              180) /
              Math.PI
          ),
        });
      }
    }
  }

  private canBotShootAtPlayer(bot: BotPlayer): boolean {
    const distance = this.getDistanceToPlayer(bot.ship.position);

    // Bot must be within shooting range
    if (distance > 400) {
      return false;
    }

    // Bot must be facing roughly towards player
    const angleToPlayer = Math.atan2(
      -(this.localPlayerPosition.y - bot.ship.position.y),
      this.localPlayerPosition.x - bot.ship.position.x
    );

    const angleDiff = Math.abs(angleToPlayer - bot.ship.a);
    const normalizedAngleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

    // Bot must be facing within 60 degrees of player
    return normalizedAngleDiff < Math.PI / 3;
  }

  private botShoot(bot: BotPlayer): void {
    if (!this.botShootCallback) {
      return;
    }

    // Calculate laser direction towards player
    const direction = this.localPlayerPosition.subtract(bot.ship.position);
    const distance = direction.magnitude();

    if (distance === 0) {
      return;
    }

    // Add some randomness to bot accuracy based on bot type and personality
    const accuracy = this.getBotAccuracy(bot.botType);
    const personalityFactor = this.getBotPersonalityFactor(bot);

    // Personality affects accuracy
    const finalAccuracy = accuracy + (personalityFactor - 0.5) * 0.2;

    // Calculate base angle to player
    const baseAngle = Math.atan2(-direction.y, direction.x);

    // Add accuracy-based randomness
    const maxSpread = ((1 - finalAccuracy) * Math.PI) / 3;
    const randomAngle = (Math.random() - 0.5) * maxSpread;

    // Add some intentional "personality" misses for aggressive bots
    let finalAngle = baseAngle + randomAngle;
    if (bot.botType === 'aggressive' && Math.random() < 0.15) {
      const herdAngle = baseAngle + ((Math.random() - 0.5) * Math.PI) / 2;
      finalAngle = herdAngle;
    }

    // Calculate laser start position (from bot's nose)
    const noseOffset = Vector.fromAngle(bot.ship.a).multiply((4 / 3) * bot.ship.r);
    const laserStart = bot.ship.position.add(noseOffset);

    // Calculate laser direction
    const laserDirection = Vector.fromAngle(finalAngle);

    const botShoot: BotShoot = {
      botId: bot.id,
      laserStart,
      laserDirection,
      targetPlayerId: this.localPlayerId,
    };

    // Create a visual laser for this shot
    this.createBotLaser(botShoot);

    // Call the callback to handle the shot logic
    this.botShootCallback(botShoot);
  }

  private getBotAccuracy(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 0.8;
      case 'defensive':
        return 0.9;
      case 'patrol':
        return 0.7;
      default:
        return 0.8;
    }
  }

  private getBotPersonalityFactor(bot: BotPlayer): number {
    // Use bot ID to create consistent personality
    const hash = bot.id.split('').reduce((a: number, b: string) => {
      a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
      return a;
    }, 0);

    return (hash & 0xff) / 255;
  }

  private getDistanceToPlayer(botPosition: Vector): number {
    return botPosition.distance(this.localPlayerPosition);
  }
}
