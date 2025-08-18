import {
  DEBUG,
  DRAW_ASTEROIDS,
  FPS,
  getCTX,
  getCVS,
  SHIP_SIZE,
  SHOW_COLLISION_CIRCLES,
  TEXT_FADE_TIME,
  TEXT_SIZE,
} from '../constants';
import { GameController } from '../core/gameController.ts';
import type { AsteroidBelt } from '../entities/asteroid/Asteroid.ts';
import { drawRoidsRelative } from '../entities/asteroid/asteroidRenderer.ts';
import { BotManager } from '../entities/bot/botManager.ts';
import type { BotPlayer } from '../entities/bot/types.ts';
import { PlayerNetwork } from '../entities/player/playerNetwork.ts';
import type { Player } from '../entities/player/types.ts';
import type { Ship } from '../entities/ship/Ship.ts';
import { drawGenericThruster, drawLasers } from '../entities/ship/shipRenderer.ts';
import { Point } from '../physics/Point.ts';
import { Vector } from '../physics/Vector.ts';
import { showGameOverMenu } from '../ui/mainMenu.ts';
import { worldToScreen } from './viewport.ts';

// Defer initialization to avoid circular dependency issues
let gameController: GameController;
let playerNetwork: PlayerNetwork;

function getGameController(): GameController {
  if (!gameController) {
    gameController = GameController.getInstance();
  }
  return gameController;
}

function getPlayerNetwork(): PlayerNetwork {
  if (!playerNetwork) {
    playerNetwork = PlayerNetwork.getInstance();
  }
  return playerNetwork;
}

export function drawSpace(): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  // Don't fill with black - let the CSS background show through
  // ctx.fillStyle = 'black';
  // ctx.fillRect(0, 0, cvs.width, cvs.height);

  // Clear the canvas with transparency instead
  ctx.clearRect(0, 0, cvs.width, cvs.height);
}

function drawGameText(textAlpha: number, text: string): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(255,255,255, ${String(textAlpha)})`;
  ctx.font = `small-caps ${String(TEXT_SIZE)}px dejavu sans mono`;
  ctx.fillText(text, cvs.width / 2, (cvs.height * 3) / 4);

  textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
  getGameController().updateTextAlpha(textAlpha);
}

function drawDebugFeatures(ship: Ship): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  // Use the same coordinate system as the ship drawing (relative to screen center)
  const x = cvs.width / 2;
  const y = cvs.height / 2;

  // Draw Ship collision bounding box (only if collision circles are enabled)
  if (SHOW_COLLISION_CIRCLES) {
    ctx.strokeStyle = 'lime';
    ctx.beginPath();
    ctx.arc(x, y, ship.r, 0, Math.PI * 2, false);
    ctx.stroke();
  }

  // Red center dot removed - was causing visual confusion
}

function drawTriangle(centroid: Point, a: number, color = 'white'): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const r = SHIP_SIZE / 2;
  const x = centroid.x;
  const y = centroid.y;

  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    x + (4 / 3) * r * Math.cos(a),
    y - (4 / 3) * r * Math.sin(a)
  );
  ctx.lineTo(
    // rear left
    x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) - Math.cos(a))
  );
  ctx.lineTo(
    // rear right
    x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) + Math.cos(a))
  );
  ctx.closePath();
  ctx.stroke();
}

function drawLives(lives: number, ship: Ship): void {
  let lifeColor: string;
  for (let i = 0; i < lives; i++) {
    lifeColor = getLifeColor(lives, ship);
    const lifeCentroid = new Point(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE);
    drawTriangle(lifeCentroid, 0.5 * Math.PI, lifeColor);
  }
}

function getLifeColor(lives: number, ship: Ship): string {
  return ship.exploding && lives === 1 ? 'red' : 'white';
}

function drawScores(score: number, personalBest: number): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  // draw the score
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.font = `${String(TEXT_SIZE)}px dejavu sans mono`;
  ctx.fillText(String(score), cvs.width - 15, 30);

  // draw the personal best
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.font = `${String(TEXT_SIZE * 0.75)}px dejavu sans mono`;
  ctx.fillText(`BEST ${String(personalBest)}`, cvs.width / 2, 30);
}

function drawOtherPlayers(localShip: Ship): void {
  const otherPlayers = getPlayerNetwork().getOtherPlayers();
  const bots = getGameController().getBots();

  // Always draw test players if they exist, regardless of multiplayer state
  // Test players are created independently of multiplayer enabled state
  const hasTestPlayers = otherPlayers.some((player) => player.id.startsWith('test-'));

  // Debug logging for test players
  if (hasTestPlayers) {
    console.debug('RENDERING_DEBUG', 'Test players found in drawOtherPlayers', {
      totalPlayers: otherPlayers.length,
      testPlayers: otherPlayers
        .filter((p) => p.id.startsWith('test-'))
        .map((p) => ({
          id: p.id,
          name: p.name,
          exploding: p.ship.exploding,
          blinkCount: p.ship.blinkCount,
          blinkOn: p.ship.blinkOn,
          position: { x: p.ship.position.x, y: p.ship.position.y },
          nearby: getPlayerNetwork().isPlayerNearby(p, localShip),
        })),
    });
  }

  // Only check multiplayer enabled for non-test players
  if (!getGameController().isMultiplayerEnabled() && !hasTestPlayers) {
    return;
  }

  // Draw human players (including test players)
  for (const player of otherPlayers) {
    // Only draw players that are nearby (within viewport)
    if (getPlayerNetwork().isPlayerNearby(player, localShip)) {
      // Don't draw if player is exploding
      if (player.ship.exploding) {
        continue;
      }

      // Don't draw if player hasn't updated recently (stale data)
      // But always draw test players since they're updated in the game loop
      const now = Date.now();
      if (!player.id.startsWith('test-') && now - player.lastUpdate > 1000) {
        continue;
      }

      // Draw the other player's ship
      drawOtherPlayerShip(player);
    } else if (player.id.startsWith('test-')) {
      // Debug logging for test players that are not nearby
      console.debug('RENDERING_DEBUG', 'Test player not nearby', {
        playerId: player.id,
        playerName: player.name,
        playerPos: { x: player.ship.position.x, y: player.ship.position.y },
        shipPos: { x: localShip.position.x, y: localShip.position.y },
        distance: Math.sqrt(
          (player.ship.position.x - localShip.position.x) ** 2 +
            (player.ship.position.y - localShip.position.y) ** 2
        ),
      });
    }
  }

  // Draw bot players (only when multiplayer is enabled)
  if (getGameController().isMultiplayerEnabled()) {
    for (const [, bot] of bots.entries()) {
      // Don't draw if bot is exploding
      if (bot.ship.exploding) {
        continue;
      }

      // Draw the bot ship
      drawBotShip(bot);
    }

    // Draw bot bullets
    drawBotBullets();
  }
}

function drawOtherPlayerShip(player: Player): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(player.ship.position, localShip.position);

  const a = player.ship.a;
  const r = player.ship.r;

  // Skip rendering if player is exploding
  if (player.ship.exploding) {
    drawPlayerExplosion(player, screenPos);
    return;
  }

  // Implement blinking effect for invincible players
  if (player.ship.blinkCount && player.ship.blinkCount > 0 && !player.ship.blinkOn) {
    // Player is invincible but currently in "off" blink state - don't render
    return;
  }

  // Use a different color to distinguish other players
  const otherPlayerColor = '#00ff00'; // Green color for other players

  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.strokeStyle = otherPlayerColor;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    screenPos.x + (4 / 3) * r * Math.cos(a),
    screenPos.y - (4 / 3) * r * Math.sin(a)
  );
  ctx.lineTo(
    // rear left
    screenPos.x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) - Math.cos(a))
  );
  ctx.lineTo(
    // rear right
    screenPos.x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) + Math.cos(a))
  );
  ctx.closePath();
  ctx.stroke();

  // Draw thruster effect for players when they're moving
  if (player.ship.velocity.magnitude() > 0.1 && !player.ship.exploding) {
    // Use default thruster color for moving players
    drawGenericThruster(screenPos.x, screenPos.y, a, r, 'default');
  }

  // Draw player name above ship
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = otherPlayerColor;
  ctx.font = '12px dejavu sans mono';
  ctx.fillText(player.name, screenPos.x, screenPos.y - r - 10);

  // Draw health bar above the name
  drawPlayerHealthBar(player, screenPos);

  // Draw player score below ship
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = otherPlayerColor;
  ctx.font = '10px dejavu sans mono';
  ctx.fillText(`Score: ${player.score}`, screenPos.x, screenPos.y + r + 5);
}

function drawPlayerHealthBar(player: Player, screenPos: Point): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const healthBarWidth = 40;
  const healthBarHeight = 4;
  const healthBarY = screenPos.y - player.ship.r - 25; // Above the name

  // Get current health and max health
  const currentHealth = player.ship.health || 100;
  const maxHealth = player.ship.maxHealth || 100;
  const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));

  // Draw health bar background (dark)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(screenPos.x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight);

  // Draw health bar border
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 1;
  ctx.strokeRect(screenPos.x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight);

  // Draw health bar fill (green to red based on health)
  let healthColor: string;
  if (healthPercent > 0.6) {
    healthColor = '#00ff00'; // Green for high health
  } else if (healthPercent > 0.3) {
    healthColor = '#ffff00'; // Yellow for medium health
  } else {
    healthColor = '#ff0000'; // Red for low health
  }

  ctx.fillStyle = healthColor;
  ctx.fillRect(
    screenPos.x - healthBarWidth / 2,
    healthBarY,
    healthBarWidth * healthPercent,
    healthBarHeight
  );

  // Draw health text above the bar
  ctx.fillStyle = '#00ff00';
  ctx.font = '8px dejavu sans mono';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${Math.ceil(currentHealth)}/${maxHealth}`, screenPos.x, healthBarY - 2);
}

function drawBotShip(bot: BotPlayer): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(bot.ship.position, localShip.position);

  const a = bot.ship.a;
  const r = bot.ship.r;

  // Skip rendering if bot is exploding
  if (bot.ship.exploding && bot.ship.explodeTime > 0) {
    drawBotExplosion(bot);
    return;
  }

  // Implement blinking effect for invincible bots
  if (bot.ship.blinkCount > 0 && !bot.ship.blinkOn) {
    // Bot is invincible but currently in "off" blink state - don't render
    return;
  }

  // Use different colors for different bot types
  let botColor: string;
  switch (bot.botType) {
    case 'aggressive':
      botColor = '#ff4444'; // Red for aggressive bots
      break;
    case 'defensive':
      botColor = '#4444ff'; // Blue for defensive bots
      break;
    case 'patrol':
      botColor = '#ff8844'; // Orange for patrol bots
      break;
    default:
      botColor = '#ff4444';
  }

  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.strokeStyle = botColor;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    screenPos.x + (4 / 3) * r * Math.cos(a),
    screenPos.y - (4 / 3) * r * Math.sin(a)
  );
  ctx.lineTo(
    // rear left
    screenPos.x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) - Math.cos(a))
  );
  ctx.lineTo(
    // rear right
    screenPos.x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) + Math.cos(a))
  );
  ctx.closePath();
  ctx.stroke();

  // Draw red centering dot at the actual geometric center of the bot triangle
  const botNose = {
    x: screenPos.x + (4 / 3) * r * Math.cos(a),
    y: screenPos.y - (4 / 3) * r * Math.sin(a),
  };
  const botRearLeft = {
    x: screenPos.x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    y: screenPos.y + r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  };
  const botRearRight = {
    x: screenPos.x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    y: screenPos.y + r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  };

  const botTriangleCenterX = (botNose.x + botRearLeft.x + botRearRight.x) / 3;
  const botTriangleCenterY = (botNose.y + botRearLeft.y + botRearRight.y) / 3;

  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(botTriangleCenterX, botTriangleCenterY, 1.5, 0, Math.PI * 2, false);
  ctx.fill();

  // Draw bot name above ship with [BOT] prefix
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = botColor;
  ctx.font = '12px dejavu sans mono';
  ctx.fillText(`[BOT] ${bot.name}`, screenPos.x, screenPos.y - r - 10);

  // Draw bot health bar above the name
  drawBotHealthBar(bot, screenPos);

  // Draw bot type and behavior state below ship
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = botColor;
  ctx.font = '10px dejavu sans mono';
  ctx.fillText(`${bot.botType} - ${bot.behaviorState}`, screenPos.x, screenPos.y + r + 5);

  // Draw thruster effect when bot is moving
  if (bot.ship.thrusterActive && !bot.ship.exploding) {
    let thrusterColor: string;
    switch (bot.botType) {
      case 'aggressive':
        thrusterColor = 'red'; // Red thruster for aggressive bots
        break;
      case 'defensive':
        thrusterColor = 'blue'; // Blue thruster for defensive bots
        break;
      case 'patrol':
        thrusterColor = 'default'; // Default orange/red thruster for patrol bots
        break;
      default:
        thrusterColor = 'default';
    }

    // Pass the bot's center position - the thruster function will draw it behind the ship
    drawGenericThruster(screenPos.x, screenPos.y, a, r, thrusterColor);
  }
}

function drawBotExplosion(bot: BotPlayer): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(bot.ship.position, localShip.position);

  const r = bot.ship.r;
  const explosionProgress = 1 - bot.ship.explodeTime / 60; // 0 to 1 over 1 second

  // Calculate explosion size and opacity
  const explosionSize = r * (1 + explosionProgress * 3);
  const opacity = 1 - explosionProgress;

  // Set explosion color based on bot type
  let explosionColor: string;
  switch (bot.botType) {
    case 'aggressive':
      explosionColor = '#ff6666';
      break;
    case 'defensive':
      explosionColor = '#6666ff';
      break;
    case 'patrol':
      explosionColor = '#ffaa66';
      break;
    default:
      explosionColor = '#ff6666';
  }

  // Draw explosion particles
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // Draw expanding circle
  ctx.strokeStyle = explosionColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, explosionSize, 0, Math.PI * 2);
  ctx.stroke();

  // Draw explosion particles
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const particleDistance = explosionSize * 0.8;
    const particleX = screenPos.x + Math.cos(angle) * particleDistance;
    const particleY = screenPos.y + Math.sin(angle) * particleDistance;

    ctx.fillStyle = explosionColor;
    ctx.beginPath();
    ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayerExplosion(player: Player, screenPos: Point): void {
  const r = player.ship.r;
  // Use explodeTime if available, otherwise use fixed duration
  const explosionDuration = player.ship.explodeTime || 60; // 1 second at 60 FPS
  const explosionProgress = 1 - explosionDuration / 60; // 0 to 1 over 1 second

  // Calculate explosion size and opacity
  const explosionSize = r * (1 + explosionProgress * 3);
  const opacity = 1 - explosionProgress;

  // Use green color for player explosions
  const explosionColor = '#00ff00';

  // Draw explosion particles
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // Draw expanding circle
  ctx.strokeStyle = explosionColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, explosionSize, 0, Math.PI * 2);
  ctx.stroke();

  // Draw explosion particles
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const particleDistance = explosionSize * 0.8;
    const particleX = screenPos.x + Math.cos(angle) * particleDistance;
    const particleY = screenPos.y + Math.sin(angle) * particleDistance;

    ctx.fillStyle = explosionColor;
    ctx.beginPath();
    ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBotBullets(): void {
  if (!getGameController().isMultiplayerEnabled()) {
    return;
  }

  const botLasersMap = BotManager.getInstance().getBotLasers();
  if (botLasersMap.size === 0) {
    return;
  }

  for (const [botId, lasers] of botLasersMap.entries()) {
    const bots = getGameController().getBots();
    const bot = bots.get(botId);
    for (const laser of lasers) {
      drawBotLaser(laser.position.x, laser.position.y, bot?.botType);
    }
  }
}

function drawBotLaser(worldX: number, worldY: number, botType?: BotPlayer['botType']): void {
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(new Vector(worldX, worldY), localShip.position);

  let color: string;
  switch (botType) {
    case 'defensive':
      color = '#4444ff';
      break;
    case 'patrol':
      color = '#ff8844';
      break;
    default:
      color = '#ff4444';
  }

  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBotHealthBar(bot: BotPlayer, screenPos: Point): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const healthBarWidth = 40;
  const healthBarHeight = 4;
  const healthBarY = screenPos.y - bot.ship.r - 25; // Above the name

  // Get current health and max health
  const currentHealth = bot.ship.health || 100;
  const maxHealth = bot.ship.maxHealth || 100;
  const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));

  // Draw health bar background (dark)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(screenPos.x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight);

  // Draw health bar border
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 1;
  ctx.strokeRect(screenPos.x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight);

  // Draw health bar fill (green to red based on health)
  let healthColor: string;
  if (healthPercent > 0.6) {
    healthColor = '#00ff00'; // Green for high health
  } else if (healthPercent > 0.3) {
    healthColor = '#ffff00'; // Yellow for medium health
  } else {
    healthColor = '#ff0000'; // Red for low health
  }

  ctx.fillStyle = healthColor;
  ctx.fillRect(
    screenPos.x - healthBarWidth / 2,
    healthBarY,
    healthBarWidth * healthPercent,
    healthBarHeight
  );

  // Draw health text above the bar
  ctx.fillStyle = '#00ff00';
  ctx.font = '8px dejavu sans mono';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${Math.ceil(currentHealth)}/${maxHealth}`, screenPos.x, healthBarY - 2);
}

function drawMultiplayerStatus(): void {
  if (!getGameController().isMultiplayerEnabled()) {
    return;
  }

  const status = getPlayerNetwork().getConnectionStatus();
  const localPlayer = getPlayerNetwork().getLocalPlayerInfo();

  // Start drawing from a safe position that won't overlap with other UI
  let yOffset = 60;
  const xPos = 15;
  const lineHeight = 18;

  // Draw connection status
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) {
    return;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = status.connected ? '#00ff00' : '#ff0000';
  ctx.font = '12px dejavu sans mono';

  const statusText = status.connected ? 'CONNECTED' : 'DISCONNECTED';
  ctx.fillText(`MP: ${statusText}`, xPos, yOffset);
  yOffset += lineHeight;

  // Get other players early so we can use them in the player count display
  const allPlayers = getPlayerNetwork().getOtherPlayers();

  // Filter out bot players to show only real players
  const realPlayers = allPlayers.filter((player) => !player.isBot);

  // Draw player count (show only real players, no server/local differentiation)
  ctx.fillStyle = '#00ff00';
  ctx.fillText(`Players: ${realPlayers.length + 1}`, xPos, yOffset);
  yOffset += lineHeight;

  // Draw local player info
  ctx.fillStyle = '#00ff00';
  ctx.fillText(`You: ${localPlayer.name}`, xPos, yOffset);
  yOffset += lineHeight;

  // Draw multiplayer mode indicator
  ctx.fillStyle = '#00ff00';
  const asteroidCount = getGameController().getCurrAsteroidCount();
  ctx.fillText(`Asteroids: ${asteroidCount} (MP Mode)`, xPos, yOffset);
  yOffset += lineHeight;

  // Show test mode indicator if using test players
  const hasTestPlayers = realPlayers.some((p) => p.id.startsWith('test-'));
  if (hasTestPlayers) {
    ctx.fillStyle = '#ffff00'; // Yellow for test mode
    ctx.fillText(`TEST MODE - Demo Players`, xPos, yOffset);
    yOffset += lineHeight;
  }

  // Draw mini-map showing only real players (no bots)
  const currentShip = getGameController().getCurrShip();
  drawMiniMap(currentShip, realPlayers, xPos, yOffset);
  yOffset += 120; // Add space for mini-map

  // Show additional debug info if debug mode is enabled
  if (DEBUG) {
    // Show each real player's position and state (limit to prevent overflow)
    const maxPlayersToShow = 5;
    let playersShown = 0;
    for (const player of realPlayers) {
      if (playersShown >= maxPlayersToShow) {
        ctx.fillText(`... and ${realPlayers.length - maxPlayersToShow} more`, xPos, yOffset);
        break;
      }
      ctx.fillStyle = '#00ffff'; // Cyan for debug info
      ctx.fillText(
        `${player.name}: (${Math.round(player.ship.position.x)}, ${Math.round(player.ship.position.y)}) - ${player.ship.exploding ? 'DEAD' : 'ALIVE'}`,
        xPos,
        yOffset
      );
      yOffset += lineHeight;
      playersShown++;
    }
  }

  // Show health summary for all players
  if (realPlayers.length > 0) {
    yOffset += lineHeight; // Add spacing
    ctx.fillStyle = '#ffff00'; // Yellow for health info
    ctx.fillText('Player Health:', xPos, yOffset);
    yOffset += lineHeight;

    // Show local player health
    const localShip = getGameController().getCurrShip();
    const localHealth = localShip.health;
    const localMaxHealth = localShip.maxHealth;
    const localHealthPercent = Math.round((localHealth / localMaxHealth) * 100);
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`You: ${localHealth}/${localMaxHealth} (${localHealthPercent}%)`, xPos, yOffset);
    yOffset += lineHeight;

    // Show other players' health
    for (const player of realPlayers) {
      if (player.ship.health !== undefined && player.ship.maxHealth !== undefined) {
        const healthPercent = Math.round((player.ship.health / player.ship.maxHealth) * 100);
        const healthColor =
          healthPercent > 60 ? '#00ff00' : healthPercent > 30 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = healthColor;
        ctx.fillText(
          `${player.name}: ${Math.ceil(player.ship.health)}/${player.ship.maxHealth} (${healthPercent}%)`,
          xPos,
          yOffset
        );
        yOffset += lineHeight;
      }
    }
  }
}

function drawMiniMap(localShip: Ship, otherPlayers: Player[], xPos: number, yPos: number): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const mapSize = 100; // 100x100 pixel mini-map
  const mapRadius = mapSize / 2;
  const mapCenterX = xPos + mapRadius;
  const mapCenterY = yPos + mapRadius;

  // Draw mini-map background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(xPos, yPos, mapSize, mapSize);
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 1;
  ctx.strokeRect(xPos, yPos, mapSize, mapSize);

  // Calculate world bounds for scaling (adjust these values based on your game world)
  const worldRadius = 2000; // Adjust based on your game world size
  const scale = mapRadius / worldRadius;

  // Draw local player (you) at center
  ctx.fillStyle = '#00ff00'; // Green for local player
  ctx.fillRect(mapCenterX - 2, mapCenterY - 2, 4, 4);

  // Draw other players
  for (const player of otherPlayers) {
    if (player.ship.exploding) {
      continue;
    }

    // Calculate relative position from local ship
    const relativeX = (player.ship.position.x - localShip.position.x) * scale;
    const relativeY = (player.ship.position.y - localShip.position.y) * scale;

    // Check if player is within mini-map bounds
    if (Math.abs(relativeX) <= mapRadius && Math.abs(relativeY) <= mapRadius) {
      const mapX = mapCenterX + relativeX;
      const mapY = mapCenterY + relativeY;

      // Draw player dot
      ctx.fillStyle = '#ffff00'; // Yellow for other players
      ctx.fillRect(mapX - 2, mapY - 2, 4, 4);
    }
  }
}

export function drawGameCanvas(
  ship: Ship,
  roidBelt: AsteroidBelt,
  currScore: number,
  personalBest: number,
  textAlpha: number,
  text: string
): void {
  try {
    // Log the start of frame drawing
    drawSpace();
    roidBelt.spawnRoids();

    if (DEBUG) {
      drawDebugFeatures(ship);
    }

    if (DRAW_ASTEROIDS) {
      drawRoidsRelative(ship, roidBelt.roids);
    }
    drawLasers(ship);

    // Draw other players if multiplayer is enabled
    drawOtherPlayers(ship);

    drawScores(currScore, personalBest);
    // Get lives from the current player
    const currentPlayer = getGameController().getCurrPlayer();
    drawLives(currentPlayer.lives, ship);

    // Draw multiplayer status
    drawMultiplayerStatus();

    if (textAlpha >= 0) {
      drawGameText(textAlpha, text);
    } else if (ship.exploding) {
      showGameOverMenu();
    }
  } catch (error) {
    console.error('CANVAS', 'Error in drawGameCanvas', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shipPos: { x: ship.position.x, y: ship.position.y },
    });
  }
}
