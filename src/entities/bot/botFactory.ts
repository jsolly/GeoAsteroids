import { v4 as uuidv4 } from 'uuid';
import { FPS, SHIP_INV_BLINK_DUR, SHIP_INV_DUR } from '../../constants';
import { Vector } from '../../physics/Vector.ts';
import { BotPlayer } from './BotPlayer.ts';

export class BotFactory {
  public createBots(count: number = 3): Map<string, BotPlayer> {
    const bots = new Map<string, BotPlayer>();
    const botTypes: Array<'aggressive' | 'defensive' | 'patrol'> = [
      'aggressive',
      'defensive',
      'patrol',
    ];

    for (let i = 0; i < count; i++) {
      const botId = `bot-${uuidv4()}`;
      const botType = botTypes[i % botTypes.length];

      // Position bots around the edges of the screen
      const position = this.getBotStartingPosition(i);

      const bot = new BotPlayer(botId, `Bot_${botType.charAt(0).toUpperCase()}_${i + 1}`, botType);

      // Configure the bot's ship after creation
      bot.ship.position = position;
      bot.ship.r = 25; // Increased from 15 to 25 for better hit detection
      bot.ship.blinkCount = this.getBlinkCount();
      bot.ship.spawnProtectionTimer = this.getBlinkTime();
      bot.ship.blinkOn = true;
      bot.lives = 3; // Set lives on the bot instance, not the ship
      bot.score = Math.floor(Math.random() * 2000);
      bot.lastUpdate = Date.now();
      bot.ship.lastShotTime = 0;
      bot.ship.shotCooldown = this.getBotShotCooldown(botType);
      bot.behaviorState = 'hunting'; // Start in hunting mode - bots only hunt, never evade
      bot.lastBehaviorChange = Date.now();
      bot.ship.thrusterActive = false;
      bot.respawnTimer = undefined;
      bot.ship.lastPosition = position;
      bot.ship.lastRotation = 0;
      bot.spawnProtectedUntil = Date.now() + this.getInvincibilityDuration() * 1000;
      bot.respawnPosition = undefined;

      bots.set(botId, bot);

      console.info('BOT_FACTORY', `Created ${botType} bot`, {
        botId,
        name: bot.name,
        position: { x: bot.ship.position.x, y: bot.ship.position.y },
        health: bot.ship.health,
        blinkCount: bot.ship.blinkCount,
        spawnProtectedUntil: bot.spawnProtectedUntil,
      });
    }

    console.info('BOT_FACTORY', 'Finished creating bots', {
      totalBots: bots.size,
      botIds: Array.from(bots.keys()),
    });

    return bots;
  }

  private getBotStartingPosition(index: number): Vector {
    // Use world coordinates instead of canvas coordinates
    // Position bots at a moderate distance from the world origin (0, 0) where the ship starts
    const margin = 150; // Moderate distance for dramatic entrance

    // Mix of positions around the center for dramatic hunting
    const positions = [
      new Vector(-margin, -margin), // Top-left
      new Vector(margin, -margin), // Top-right
      new Vector(margin, margin), // Bottom-right
      new Vector(-margin, margin), // Bottom-left
      new Vector(margin, 0), // Right of world center
      new Vector(-margin, 0), // Left of world center
      new Vector(0, margin), // Below world center
      new Vector(0, -margin), // Above world center
    ];

    return positions[index % positions.length];
  }

  private getBotShotCooldown(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 300 + Math.random() * 700; // 0.3-1.0 seconds (much more aggressive)
      case 'defensive':
        return 500 + Math.random() * 1000; // 0.5-1.5 seconds (more aggressive)
      case 'patrol':
        return 400 + Math.random() * 800; // 0.4-1.2 seconds (more aggressive)
      default:
        return 500;
    }
  }

  private getBlinkCount(): number {
    return Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  }

  private getBlinkTime(): number {
    return Math.ceil(SHIP_INV_BLINK_DUR * FPS);
  }

  private getInvincibilityDuration(): number {
    return SHIP_INV_DUR;
  }
}
