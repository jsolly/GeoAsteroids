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

// Consider tweaking if jitter causes flicker
const REMOTE_PLAYER_STALE_MS = 1500;

// Thruster speed threshold (squared to avoid sqrt in render loop)
const THRUSTER_SPEED_THRESHOLD_SQ = 0.01; // (0.1)^2

import { GameController } from '../core/gameController';
import type { AsteroidBelt } from '../entities/asteroid/Asteroid';
import { drawRoidsRelative } from '../entities/asteroid/asteroidRenderer';
import { BotManager } from '../entities/bot/botManager';
// import type { BotPlayer } from '../entities/bot/types';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import type { Player } from '../entities/player/types';
import type { Ship } from '../entities/ship/Ship';
import { drawGenericThruster } from '../entities/ship/shipRenderer';
import { Point } from '../physics/Point';
// Dynamic import to avoid chunking conflicts with other dynamic imports
import { worldToScreen } from './viewport';

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

function drawTriangle(centroid: Point, angle: number, color = 'white'): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const radius = SHIP_SIZE / 2;
  const x = centroid.x;
  const y = centroid.y;

  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    x + (4 / 3) * radius * Math.cos(angle),
    y - (4 / 3) * radius * Math.sin(angle)
  );
  ctx.lineTo(
    // rear left
    x - radius * ((2 / 3) * Math.cos(angle) + Math.sin(angle)),
    y + radius * ((2 / 3) * Math.sin(angle) - Math.cos(angle))
  );
  ctx.lineTo(
    // rear right
    x - radius * ((2 / 3) * Math.cos(angle) - Math.sin(angle)),
    y + radius * ((2 / 3) * Math.sin(angle) + Math.cos(angle))
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

  // Only draw players when multiplayer is enabled
  if (!getGameController().isMultiplayerEnabled()) {
    return;
  }

  // Draw human players
  for (const player of otherPlayers) {
    // Only draw players that are nearby (within viewport)
    if (getPlayerNetwork().isPlayerNearby(player, localShip)) {
      // Don't draw if player is exploding
      if (player.ship.exploding) {
        continue;
      }

      // Don't draw if player hasn't updated recently (stale data)
      const now = Date.now();
      if (now - player.lastUpdate > REMOTE_PLAYER_STALE_MS) {
        continue;
      }

      // Implement blinking effect for invincible players
      if (player.ship.blinkCount && player.ship.blinkCount > 0 && !player.ship.blinkOn) {
        // Player is invincible but currently in "off" blink state - don't render
        continue;
      }

      // Get the local ship position for viewport transformation
      const localShip = getGameController().getCurrShip();
      const screenPos = worldToScreen(player.ship.position, localShip.position);

      // Draw the other player's ship
      drawShip(player.ship, screenPos, player.color, {
        name: player.name,
        score: player.score,
        showThruster:
          player.ship.velocity.x ** 2 + player.ship.velocity.y ** 2 > THRUSTER_SPEED_THRESHOLD_SQ,
        thrusterColor: 'default',
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

      // Implement blinking effect for invincible bots
      if (bot.ship.blinkCount > 0 && !bot.ship.blinkOn) {
        // Bot is invincible but currently in "off" blink state - don't render
        continue;
      }

      // Get the local ship position for viewport transformation
      const localShip = getGameController().getCurrShip();
      const screenPos = worldToScreen(bot.ship.position, localShip.position);

      // Draw the bot ship
      drawShip(bot.ship, screenPos, bot.color, {
        name: bot.name,
        isBot: true,
        botType: bot.botType,
        behaviorState: bot.behaviorState,
        showThruster: bot.ship.thrusterActive,
        thrusterColor:
          bot.botType === 'aggressive' ? 'red' : bot.botType === 'defensive' ? 'blue' : 'default',
      });
    }

    // Draw bot lasers
    drawAllLasers();
  }
}

function drawShip(
  ship: Ship,
  screenPos: Point,
  color: string,
  options: {
    name?: string;
    isBot?: boolean;
    botType?: string;
    behaviorState?: string;
    score?: number;
    showThruster?: boolean;
    thrusterColor?: string;
  } = {}
): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const angle = ship.angle;
  const r = ship.r;

  // Draw ship triangle
  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    screenPos.x + (4 / 3) * r * Math.cos(angle),
    screenPos.y - (4 / 3) * r * Math.sin(angle)
  );
  ctx.lineTo(
    // rear left
    screenPos.x - r * ((2 / 3) * Math.cos(angle) + Math.sin(angle)),
    screenPos.y + r * ((2 / 3) * Math.sin(angle) - Math.cos(angle))
  );
  ctx.lineTo(
    // rear right
    screenPos.x - r * ((2 / 3) * Math.cos(angle) - Math.sin(angle)),
    screenPos.y + r * ((2 / 3) * Math.sin(angle) + Math.cos(angle))
  );
  ctx.closePath();
  ctx.stroke();

  // Draw thruster effect if enabled
  if (options.showThruster && !ship.exploding) {
    const thrusterColor = options.thrusterColor || 'default';
    drawGenericThruster(screenPos.x, screenPos.y, angle, r, thrusterColor);
  }

  // Draw name above ship
  if (options.name) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color;
    ctx.font = '12px dejavu sans mono';
    const displayName = options.isBot ? `[BOT] ${options.name}` : options.name;
    ctx.fillText(displayName, screenPos.x, screenPos.y - r - 10);
  }

  // Draw health bar above the name
  drawUnifiedHealthBar(screenPos, ship.health || 100, ship.maxHealth || 100, r, {
    width: 40,
    height: 4,
    borderColor: '#00ff00',
    textColor: '#00ff00',
    showText: true,
    textAbove: true,
  });

  // Draw info below ship
  if (options.isBot && options.botType && options.behaviorState) {
    // Bot info
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.font = '10px dejavu sans mono';
    ctx.fillText(`${options.botType} - ${options.behaviorState}`, screenPos.x, screenPos.y + r + 5);
  } else if (options.score !== undefined) {
    // Player score
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.font = '10px dejavu sans mono';
    ctx.fillText(`Score: ${options.score}`, screenPos.x, screenPos.y + r + 5);
  }
}

function drawUnifiedHealthBar(
  screenPos: Point,
  currentHealth: number,
  maxHealth: number,
  radius: number,
  options: {
    width?: number;
    height?: number;
    borderColor?: string;
    textColor?: string;
    showText?: boolean;
    textAbove?: boolean;
  } = {}
): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  // Default options
  const width = options.width || radius * 2.5;
  const height = options.height || 6;
  const borderColor = options.borderColor || '#00ff00';
  const textColor = options.textColor || '#00ff00';
  const showText = options.showText !== false;
  const textAbove = options.textAbove || false;

  const healthBarY = screenPos.y - radius - (textAbove ? 25 : 15);

  // Get health percentage
  const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));

  // Draw health bar background (dark)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(screenPos.x - width / 2, healthBarY, width, height);

  // Draw health bar border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(screenPos.x - width / 2, healthBarY, width, height);

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
  ctx.fillRect(screenPos.x - width / 2, healthBarY, width * healthPercent, height);

  // Draw health text if enabled
  if (showText) {
    ctx.fillStyle = textColor;
    ctx.font = '8px dejavu sans mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = textAbove ? 'bottom' : 'top';
    const textY = textAbove ? healthBarY - 2 : healthBarY + height + 2;
    ctx.fillText(`${Math.ceil(currentHealth)}/${maxHealth}`, screenPos.x, textY);
  }
}

function drawAllLasers(): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  const localShip = getGameController().getCurrShip();

  // Draw player lasers
  const currentPlayer = getGameController().getCurrPlayer();
  if (currentPlayer && localShip.lasers.length > 0) {
    for (const laser of localShip.lasers) {
      const screenPos = worldToScreen(laser.position, localShip.position);
      drawLaser(screenPos, currentPlayer.color, laser.explodeTime);
    }
  }

  // Draw bot lasers if multiplayer is enabled
  if (getGameController().isMultiplayerEnabled()) {
    const botLasersMap = BotManager.getInstance().getBotLasers();
    for (const [botId, lasers] of botLasersMap.entries()) {
      const bots = getGameController().getBots();
      const bot = bots.get(botId);
      if (bot) {
        for (const laser of lasers) {
          const screenPos = worldToScreen(laser.position, localShip.position);
          drawLaser(screenPos, bot.color, laser.explodeTime);
        }
      }
    }
  }
}

// Helper function to draw a single laser
function drawLaser(screenPos: Point, color: string, explodeTime: number): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  ctx.save();

  if (explodeTime === 0) {
    // Normal laser
    ctx.fillStyle = color;
    const laserRadius = SHIP_SIZE / 3;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, laserRadius, 0, Math.PI * 2, false);
    ctx.fill();
  } else {
    // Exploding laser
    ctx.fillStyle = 'orangered';
    const explosionRadius = SHIP_SIZE / 2;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, explosionRadius, 0, Math.PI * 2, false);
    ctx.fill();

    ctx.fillStyle = color;
    const laserRadius = SHIP_SIZE / 3;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, laserRadius, 0, Math.PI * 2, false);
    ctx.fill();
  }

  ctx.restore();
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
    } else if (ship.exploding && ship.explodeTime === 0) {
      // Only show game over when explosion animation is finished
      const currentPlayer = getGameController().getCurrPlayer();
      if (currentPlayer && currentPlayer.lives <= 0) {
        // Dynamic import to avoid chunking conflicts
        import('../ui/mainMenu').then(({ showGameOverMenu }) => {
          showGameOverMenu();
        });
      }
    }
  } catch (error) {
    console.error('CANVAS', 'Error in drawGameCanvas', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shipPos: { x: ship.position.x, y: ship.position.y },
    });
  }
}
