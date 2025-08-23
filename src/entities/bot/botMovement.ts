import { FPS, FRICTION, SHIP_THRUST } from '../../constants';
import {
  addPositions,
  addVectors,
  createPositionFromAngle,
  getDistance,
  multiplyPosition,
  multiplyVelocity,
  subtractPositions,
} from '../../utils/mathUtils';
import type { Position } from '../player/types';
import type { BotPlayer } from './types';

// Enhanced bot movement with steering behaviors
interface BotSteering {
  desired: Position;
  steering: Position;
  maxSpeed: number;
  maxForce: number;
  wanderAngle: number;
  wanderRadius: number;
  wanderDistance: number;
  wanderJitter: number;
  rotationVelocity: number;
  targetRotation: number;
}

export class BotMovement {
  private botSteering: Map<string, BotSteering> = new Map();
  private localPlayerPosition: Position = { x: 0, y: 0 };
  private localPlayerAlive: boolean = true;
  public debugMovementDisabled: boolean = false;

  public setLocalPlayerInfo(position: Position, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;
  }

  public initializeBotSteering(botId: string, botType: string): void {
    const steering: BotSteering = {
      desired: { x: 0, y: 0 },
      steering: { x: 0, y: 0 },
      maxSpeed: this.getBotMaxSpeed(botType),
      maxForce: this.getBotMaxForce(botType),
      wanderAngle: Math.random() * Math.PI * 2,
      wanderRadius: 15 + Math.random() * 10,
      wanderDistance: 50 + Math.random() * 30,
      wanderJitter: 0.3 + Math.random() * 0.4,
      rotationVelocity: 0,
      targetRotation: 0,
    };

    this.botSteering.set(botId, steering);
  }

  public removeBotSteering(botId: string): void {
    this.botSteering.delete(botId);
  }

  public clearAllSteering(): void {
    this.botSteering.clear();
  }

  public moveBot(bot: BotPlayer): void {
    // Check if bot movement is disabled in debug mode
    if (this.debugMovementDisabled) {
      return; // Don't move bots in debug mode
    }

    const steering = this.botSteering.get(bot.id);
    if (!steering) {
      return;
    }

    // Determine if bot should thrust based on behavior
    let shouldThrust = false;
    let thrustDirection = bot.ship.angle;

    switch (bot.behaviorState) {
      case 'hunting': {
        if (this.localPlayerAlive) {
          const direction = subtractPositions(this.localPlayerPosition, bot.ship.position);
          const distance = getDistance(this.localPlayerPosition, bot.ship.position);

          if (distance > 0) {
            thrustDirection = Math.atan2(-direction.y, direction.x);
            shouldThrust = true;
          }
        }
        break;
      }
    }

    // Update bot rotation to face the desired direction BEFORE thrusting
    this.updateBotRotation(bot, thrustDirection);

    // If we're still turning a lot, don't thrust yet
    let angleOk = true;
    {
      let diff = Math.abs(thrustDirection - bot.ship.angle);
      diff = Math.min(diff, Math.PI * 2 - diff);
      angleOk = diff < 0.6;
    }

    // Apply thrust like the player ship does
    if (shouldThrust && angleOk && !bot.ship.exploding) {
      const thrust = createPositionFromAngle(bot.ship.angle, SHIP_THRUST / FPS);
      bot.ship.velocity = addVectors(bot.ship.velocity, thrust);
      bot.ship.thrusterActive = true;
    } else {
      bot.ship.thrusterActive = false;

      // Apply friction when not thrusting
      bot.ship.velocity = multiplyVelocity(bot.ship.velocity, 1 - FRICTION / FPS);
    }

    // Move the bot using velocity
    bot.ship.position = addPositions(bot.ship.position, bot.ship.velocity);

    // Add position smoothing to reduce flickering
    if (bot.ship.lastPosition) {
      const smoothingFactor = 0.1;
      bot.ship.position = addPositions(
        multiplyPosition(bot.ship.lastPosition, 1 - smoothingFactor),
        multiplyPosition(bot.ship.position, smoothingFactor)
      );
    }
    bot.ship.lastPosition = { x: bot.ship.position.x, y: bot.ship.position.y };
  }

  private updateBotRotation(bot: BotPlayer, desiredDirection: number): void {
    const targetAngle = desiredDirection;
    this.smoothBotRotation(bot, targetAngle);
  }

  private smoothBotRotation(bot: BotPlayer, targetAngle: number): void {
    const steering = this.botSteering.get(bot.id);
    if (!steering) {
      return;
    }

    steering.targetRotation = targetAngle;

    let angleDiff = targetAngle - bot.ship.angle;

    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) {
      angleDiff -= Math.PI * 2;
    }
    while (angleDiff < -Math.PI) {
      angleDiff += Math.PI * 2;
    }

    if (Math.abs(angleDiff) < 0.01) {
      return;
    }

    // Calculate rotation acceleration based on bot type
    let rotationAcceleration: number;
    switch (bot.botType) {
      case 'aggressive':
        rotationAcceleration = 0.08;
        break;
      case 'defensive':
        rotationAcceleration = 0.06;
        break;
      case 'patrol':
        rotationAcceleration = 0.07;
        break;
      default:
        rotationAcceleration = 0.07;
    }

    // Apply rotation acceleration based on angle difference
    if (angleDiff > 0) {
      steering.rotationVelocity += rotationAcceleration;
    } else {
      steering.rotationVelocity -= rotationAcceleration;
    }

    // Limit rotation velocity
    const maxRotationVelocity = 0.4;
    steering.rotationVelocity = Math.max(
      -maxRotationVelocity,
      Math.min(maxRotationVelocity, steering.rotationVelocity)
    );

    // Apply rotation velocity to angle
    bot.ship.angle += steering.rotationVelocity;

    // Apply rotation damping
    steering.rotationVelocity *= 0.7;

    // Add rotation smoothing
    if (bot.ship.lastRotation !== undefined) {
      const rotationSmoothingFactor = 0.2;
      const angleDiff = bot.ship.angle - bot.ship.lastRotation;
      let normalizedDiff = angleDiff;
      while (normalizedDiff > Math.PI) {
        normalizedDiff -= Math.PI * 2;
      }
      while (normalizedDiff < -Math.PI) {
        normalizedDiff += Math.PI * 2;
      }

      bot.ship.angle = bot.ship.lastRotation + normalizedDiff * rotationSmoothingFactor;
    }
    bot.ship.lastRotation = bot.ship.angle;

    // Keep angle in [0, 2π] range
    while (bot.ship.angle < 0) {
      bot.ship.angle += Math.PI * 2;
    }
    while (bot.ship.angle >= Math.PI * 2) {
      bot.ship.angle -= Math.PI * 2;
    }
  }

  public resetBotSteering(botId: string): void {
    const steering = this.botSteering.get(botId);
    if (steering) {
      steering.wanderAngle = Math.random() * Math.PI * 2;
      steering.desired = { x: 0, y: 0 };
      steering.steering = { x: 0, y: 0 };
      steering.rotationVelocity = 0;
      steering.targetRotation = Math.random() * Math.PI * 2;
    }
  }

  private getBotMaxSpeed(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 4.0 + Math.random() * 1.5;
      case 'defensive':
        return 3.5 + Math.random() * 1.0;
      case 'patrol':
        return 3.8 + Math.random() * 1.2;
      default:
        return 4.0;
    }
  }

  private getBotMaxForce(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 2.0 + Math.random() * 1.0;
      case 'defensive':
        return 1.5 + Math.random() * 0.8;
      case 'patrol':
        return 1.8 + Math.random() * 1.0;
      default:
        return 2.0;
    }
  }
}
