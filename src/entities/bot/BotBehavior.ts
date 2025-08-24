import type { Position, Velocity } from '../../../shared-types';
import type { Player } from '../player/Player';
import { isBot } from '../player/playerKinds';
import type { Roid } from '../roid/Roid';

export interface BotShoot {
  botId: string;
  laserStart: Position;
  laserDirection: Velocity;
  targetPlayerId: string;
}

export class BotBehavior {
  private localPlayerPosition: Position = { x: 0, y: 0 };
  private localPlayerAlive: boolean = true;

  private steeringTargets: Map<string, Position> = new Map();
  public debugMovementDisabled: boolean = false;

  setLocalPlayerInfo(_id: string, position: Position, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;
  }

  // Movement methods
  initializeBotSteering(botId: string): void {
    // Initialize with a random target position
    const target = this.getRandomTargetPosition();
    this.steeringTargets.set(botId, target);
  }

  removeBotSteering(botId: string): void {
    this.steeringTargets.delete(botId);
  }

  clearAllSteering(): void {
    this.steeringTargets.clear();
  }

  moveBot(bot: Player, roids: Roid[], otherPlayers: Player[] = []): void {
    if (!isBot(bot) || bot.ship.exploding || this.debugMovementDisabled) {
      return;
    }

    // Choose a movement target: hunt local player if alive, otherwise roam
    let target: Position | undefined;
    if (this.localPlayerAlive) {
      target = { x: this.localPlayerPosition.x, y: this.localPlayerPosition.y };
    } else {
      target = this.steeringTargets.get(bot.id);
      if (!target) {
        target = this.getRandomTargetPosition();
        this.steeringTargets.set(bot.id, target);
      }
      // If reached roaming target, choose a new one
      const dxT = target.x - bot.ship.position.x;
      const dyT = target.y - bot.ship.position.y;
      const distanceT = Math.hypot(dxT, dyT);
      if (distanceT < 50) {
        const newTarget = this.getRandomTargetPosition();
        this.steeringTargets.set(bot.id, newTarget);
        target = newTarget;
      }
    }

    // Adjust target using roid avoidance
    let adjustedTarget = this.adjustTargetForRoids(bot, target, roids);

    // Add short-range avoidance to players to reduce collisions
    adjustedTarget = this.adjustTargetForPlayers(bot, adjustedTarget, otherPlayers);

    // Calculate desired facing direction (Ship forward is [cos(a), -sin(a)])
    const dx = adjustedTarget.x - bot.ship.position.x;
    const dy = adjustedTarget.y - bot.ship.position.y;
    const desiredAngle = Math.atan2(-dy, dx);

    // Smoothly rotate toward desiredAngle using angular velocity
    this.smoothRotateTowards(bot, desiredAngle);

    // Thrust more aggressively - bots should be more active
    const angleDiff = this.getSmallestAngleDiff(desiredAngle, bot.ship.angle);
    const thrustAngleThreshold = 1.2; // ~68 degrees - much more generous
    bot.ship.thrusting = Math.abs(angleDiff) < thrustAngleThreshold && !bot.ship.exploding;
  }

  private adjustTargetForRoids(bot: Player, originalTarget: Position, roids: Roid[]): Position {
    const maxAvoidanceDistance = 120; // Maximum distance for avoidance influence

    const adjustedTarget = { ...originalTarget };
    let totalAvoidanceX = 0;
    let totalAvoidanceY = 0;
    let avoidanceCount = 0;

    for (const roid of roids) {
      const distance = this.getDistance(bot.ship.position, roid.position);

      if (distance < maxAvoidanceDistance) {
        // Calculate avoidance vector (away from roid)
        const dx = bot.ship.position.x - roid.position.x;
        const dy = bot.ship.position.y - roid.position.y;
        const roidDistance = Math.sqrt(dx * dx + dy * dy);

        if (roidDistance > 0) {
          // Stronger avoidance for closer roids
          const avoidanceStrength = Math.max(
            0,
            (maxAvoidanceDistance - distance) / maxAvoidanceDistance
          );
          const normalizedDx = dx / roidDistance;
          const normalizedDy = dy / roidDistance;

          totalAvoidanceX += normalizedDx * avoidanceStrength;
          totalAvoidanceY += normalizedDy * avoidanceStrength;
          avoidanceCount++;
        }
      }
    }

    // Apply avoidance if any roids are nearby
    if (avoidanceCount > 0) {
      const averageAvoidanceX = totalAvoidanceX / avoidanceCount;
      const averageAvoidanceY = totalAvoidanceY / avoidanceCount;

      // Blend original target with avoidance (70% target, 30% avoidance)
      adjustedTarget.x =
        originalTarget.x * 0.7 + (bot.ship.position.x + averageAvoidanceX * 100) * 0.3;
      adjustedTarget.y =
        originalTarget.y * 0.7 + (bot.ship.position.y + averageAvoidanceY * 100) * 0.3;
    }

    return adjustedTarget;
  }

  private adjustTargetForPlayers(
    bot: Player,
    originalTarget: Position,
    otherPlayers: Player[]
  ): Position {
    // Only apply close-range separation to avoid damaging collisions
    const separationDistance = 100; // pixels; tuned to reduce body collisions

    const adjustedTarget = { ...originalTarget };
    let totalRepelX = 0;
    let totalRepelY = 0;
    let closePlayers = 0;

    // Consider local player as well
    const localDistance = this.getDistance(bot.ship.position, this.localPlayerPosition);
    if (this.localPlayerAlive && localDistance < separationDistance) {
      const dx = bot.ship.position.x - this.localPlayerPosition.x;
      const dy = bot.ship.position.y - this.localPlayerPosition.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        const strength = (separationDistance - d) / separationDistance; // 0..1
        totalRepelX += (dx / d) * strength;
        totalRepelY += (dy / d) * strength;
        closePlayers++;
      }
    }

    // Consider other remote players
    for (const p of otherPlayers) {
      const dToPlayer = this.getDistance(bot.ship.position, p.ship.position);
      if (dToPlayer < separationDistance) {
        const dx = bot.ship.position.x - p.ship.position.x;
        const dy = bot.ship.position.y - p.ship.position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0) {
          const strength = (separationDistance - d) / separationDistance;
          totalRepelX += (dx / d) * strength;
          totalRepelY += (dy / d) * strength;
          closePlayers++;
        }
      }
    }

    if (closePlayers > 0) {
      const avgRepelX = totalRepelX / closePlayers;
      const avgRepelY = totalRepelY / closePlayers;

      // Blend original target with separation (80% target, 20% separation)
      adjustedTarget.x = originalTarget.x * 0.8 + (bot.ship.position.x + avgRepelX * 120) * 0.2;
      adjustedTarget.y = originalTarget.y * 0.8 + (bot.ship.position.y + avgRepelY * 120) * 0.2;
    }

    return adjustedTarget;
  }

  private getRandomTargetPosition(): Position {
    const margin = 200;
    return {
      x: (Math.random() - 0.5) * margin * 2,
      y: (Math.random() - 0.5) * margin * 2,
    };
  }

  private smoothRotateTowards(bot: Player, targetAngle: number): void {
    if (!isBot(bot)) {
      return;
    }

    // Compute smallest signed angle difference
    let angleDiff = targetAngle - bot.ship.angle;
    while (angleDiff > Math.PI) {
      angleDiff -= Math.PI * 2;
    }
    while (angleDiff < -Math.PI) {
      angleDiff += Math.PI * 2;
    }

    // Rotation acceleration for bots
    const rotationAcceleration = 0.07;

    // Apply rotation acceleration toward the target
    if (angleDiff > 0) {
      bot.ship.angularVelocity += rotationAcceleration;
    } else {
      bot.ship.angularVelocity -= rotationAcceleration;
    }

    // Clamp rotation velocity
    const maxRotationVelocity = 0.4;
    if (bot.ship.angularVelocity > maxRotationVelocity) {
      bot.ship.angularVelocity = maxRotationVelocity;
    }
    if (bot.ship.angularVelocity < -maxRotationVelocity) {
      bot.ship.angularVelocity = -maxRotationVelocity;
    }

    // Dampen rotation for smoothness
    bot.ship.angularVelocity *= 0.7;
  }

  private getSmallestAngleDiff(a: number, b: number): number {
    let diff = a - b;
    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }
    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }
    return diff;
  }

  // Combat methods
  updateBotShooting(bots: Map<string, Player>): void {
    for (const [, bot] of bots.entries()) {
      if (!isBot(bot) || bot.ship.exploding) {
        continue;
      }

      // Check if bot should shoot
      if (this.shouldBotShoot(bot)) {
        this.makeBotShoot(bot);
      }
    }
  }

  private shouldBotShoot(bot: Player): boolean {
    if (!isBot(bot) || !this.localPlayerAlive) {
      return false;
    }

    // Check cooldown
    const now = Date.now();
    if (now - bot.ship.lastShotTime < bot.ship.shotCooldown) {
      return false;
    }

    // Check if player is in range and roughly in front
    const distance = this.getDistance(bot.ship.position, this.localPlayerPosition);
    if (distance > 300) {
      return false;
    }

    // Angle from ship to player using ship's forward convention
    const desiredAngle = Math.atan2(
      -(this.localPlayerPosition.y - bot.ship.position.y),
      this.localPlayerPosition.x - bot.ship.position.x
    );
    const angleDiff = Math.abs(this.getSmallestAngleDiff(desiredAngle, bot.ship.angle));
    return angleDiff < 0.25; // ~14 degrees
  }

  private makeBotShoot(bot: Player): void {
    // Shoot straight (from current ship angle) using the same system as players
    if (isBot(bot)) {
      bot.ship.fireLaser();
      bot.ship.lastShotTime = Date.now();
    }
  }

  private getDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Update bot lasers using Ship's built-in laser movement system
  updateBotLasers(bots: Map<string, Player>): void {
    for (const [, bot] of bots.entries()) {
      if (!isBot(bot)) {
        continue;
      }

      // Use Ship's built-in laser movement method (unified system)
      bot.ship.moveLasers();
    }
  }

  clearBotLasers(bots: Map<string, Player>): void {
    for (const [, bot] of bots.entries()) {
      if (!isBot(bot)) {
        continue;
      }

      // Clear bot's ship lasers (unified system)
      bot.ship.lasers = [];
    }
  }
}
