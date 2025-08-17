import {
  FPS,
  TEXT_SIZE,
  TEXT_FADE_TIME,
  SHIP_SIZE,
  getCVS,
  getCTX,
  DEBUG,
  MULTIPLAYER_DEBUG,
  SHOW_COLLISION_CIRCLES,
} from './constants';
import { Ship } from './ship';
import { Point } from './point';
import { drawRoidsRelative } from './asteroidsCanv';
import { drawLasers } from './shipCanv';
import { showGameOverMenu } from './mainMenu';
import { RoidBelt } from './asteroids';
import { GameController } from './gameController';
import { PlayerNetwork } from './playerNetwork.js';
import { IPlayer, IBotPlayer, IBotBullet } from './types/multiplayer.js';
import { logError } from './logger.js';
import { worldToScreen } from './utils';
import { drawGenericThruster } from './shipCanv';

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

/**
 * Draws the background
 */
function drawSpace(): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  // Don't fill with black - let the CSS background show through
  // ctx.fillStyle = 'black';
  // ctx.fillRect(0, 0, cvs.width, cvs.height);

  // Clear the canvas with transparency instead
  ctx.clearRect(0, 0, cvs.width, cvs.height);
}

/**
 * Draws text such as "Game Over", "Level 1." Text usually has an Alpha + fade
 * value so the text eventually disappears.
 */
function drawGameText(textAlpha: number, text: string): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255, ' + String(textAlpha) + ')';
  ctx.font = 'small-caps ' + String(TEXT_SIZE) + 'px dejavu sans mono';
  ctx.fillText(text, cvs.width / 2, (cvs.height * 3) / 4);

  textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
  getGameController().updateTextAlpha(textAlpha);
}

/**
 * Draws the polygons that are used to detect collisions. Also shows you the
 * CENTER dot for the ship.
 */
function drawDebugFeatures(ship: Ship): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

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
  if (!ctx) return;

  const r = SHIP_SIZE / 2;
  const x = centroid.x;
  const y = centroid.y;

  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    x + (4 / 3) * r * Math.cos(a),
    y - (4 / 3) * r * Math.sin(a),
  );
  ctx.lineTo(
    // rear left
    x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  ctx.lineTo(
    // rear right
    x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  );
  ctx.closePath();
  ctx.stroke();
}

/**
 * Draw number of lives left on canvas
 */
function drawLives(ship: Ship): void {
  let lifeColor;
  for (let i = 0; i < ship.lives; i++) {
    lifeColor = getLifeColor(ship);
    const lifeCentroid = new Point(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE);
    drawTriangle(lifeCentroid, 0.5 * Math.PI, lifeColor);
  }
}

function getLifeColor(ship: Ship): string {
  const currLives = ship.lives;
  return ship.exploding && currLives == ship.lives - 1 ? 'red' : 'white';
}

/**
 * Draw current score and high score on canvas
 */
function drawScores(score: number, personalBest: number): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  // draw the score
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.font = String(TEXT_SIZE) + 'px dejavu sans mono';
  ctx.fillText(String(score), cvs.width - 15, 30);

  // draw the personal best
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.font = String(TEXT_SIZE * 0.75) + 'px dejavu sans mono';
  ctx.fillText('BEST ' + String(personalBest), cvs.width / 2, 30);
}

/**
 * Draw other players and bots
 */
function drawOtherPlayers(localShip: Ship): void {
  if (!getGameController().isMultiplayerEnabled()) {
    return;
  }

  const otherPlayers = getPlayerNetwork().getOtherPlayers();
  const bots = getGameController().getBots();

  // Draw human players
  for (const player of otherPlayers) {
    // Only draw players that are nearby (within viewport)
    if (getPlayerNetwork().isPlayerNearby(player, localShip)) {
      // Don't draw if player is dead or exploding
      if (player.dead || player.exploding) {
        continue;
      }

      // Don't draw if player hasn't updated recently (stale data)
      const now = Date.now();
      if (now - player.lastUpdate > 1000) {
        continue;
      }

      // Draw the other player's ship
      drawOtherPlayerShip(player);
    }
  }

  // Draw bot players
  for (const [, bot] of bots.entries()) {
    // Don't draw if bot is dead or exploding
    if (bot.dead || bot.exploding) {
      continue;
    }

    // Draw the bot ship
    drawBotShip(bot);
  }

  // Draw bot bullets
  drawBotBullets();
}

/**
 * Draw a single other player's ship
 */
function drawOtherPlayerShip(player: IPlayer): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(player.position, localShip.position);

  const a = player.a;
  const r = player.r;

  // Use a different color to distinguish other players
  const otherPlayerColor = '#00ff00'; // Green color for other players

  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  ctx.strokeStyle = otherPlayerColor;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    screenPos.x + (4 / 3) * r * Math.cos(a),
    screenPos.y - (4 / 3) * r * Math.sin(a),
  );
  ctx.lineTo(
    // rear left
    screenPos.x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  ctx.lineTo(
    // rear right
    screenPos.x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  );
  ctx.closePath();
  ctx.stroke();

  // Draw player name above ship
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = otherPlayerColor;
  ctx.font = '12px dejavu sans mono';
  ctx.fillText(player.name, screenPos.x, screenPos.y - r - 10);

  // Draw player score below ship
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = otherPlayerColor;
  ctx.font = '10px dejavu sans mono';
  ctx.fillText(`Score: ${player.score}`, screenPos.x, screenPos.y + r + 5);
}

/**
 * Draw a single bot ship
 */
function drawBotShip(bot: IBotPlayer): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(bot.position, localShip.position);

  const a = bot.a;
  const r = bot.r;

  // Skip rendering if bot is dead and not exploding
  if (bot.dead && !bot.exploding) {
    return;
  }

  // If bot is exploding, draw explosion effect
  if (bot.exploding && bot.explodeTime > 0) {
    drawBotExplosion(bot);
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
  if (!ctx || !cvs) return;

  ctx.strokeStyle = botColor;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    screenPos.x + (4 / 3) * r * Math.cos(a),
    screenPos.y - (4 / 3) * r * Math.sin(a),
  );
  ctx.lineTo(
    // rear left
    screenPos.x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  ctx.lineTo(
    // rear right
    screenPos.x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    screenPos.y + r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
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

  // Draw bot type and behavior state below ship
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = botColor;
  ctx.font = '10px dejavu sans mono';
  ctx.fillText(
    `${bot.botType} - ${bot.behaviorState}`,
    screenPos.x,
    screenPos.y + r + 5,
  );

  // Draw thruster effect when bot is moving
  if (bot.thrusterActive && !bot.dead && !bot.exploding) {
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

/**
 * Draw bot explosion effect
 */
function drawBotExplosion(bot: IBotPlayer): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(bot.position, localShip.position);

  const r = bot.r;
  const explosionProgress = 1 - bot.explodeTime / 60; // 0 to 1 over 1 second

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
  if (!ctx || !cvs) return;

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

/**
 * Draw bot bullets
 */
function drawBotBullets(): void {
  if (!getGameController().isMultiplayerEnabled()) {
    return;
  }

  const botBullets = getGameController().getBotBullets();
  if (botBullets.size === 0) {
    return;
  }

  // Draw each bot bullet
  for (const [, bullet] of botBullets.entries()) {
    drawBotBullet(bullet);
  }
}

/**
 * Draw a single bot bullet
 */
function drawBotBullet(bullet: IBotBullet): void {
  // Get the local ship position for viewport transformation
  const localShip = getGameController().getCurrShip();
  const screenPos = worldToScreen(bullet.position, localShip.position);

  // Get the bot that fired this bullet to determine color
  const bots = getGameController().getBots();
  const bot = bots.get(bullet.botId);

  // Set bullet color based on bot type (or default to red)
  let bulletColor: string;
  if (bot) {
    switch (bot.botType) {
      case 'aggressive':
        bulletColor = '#ff4444'; // Red for aggressive bots
        break;
      case 'defensive':
        bulletColor = '#4444ff'; // Blue for defensive bots
        break;
      case 'patrol':
        bulletColor = '#ff8844'; // Orange for patrol bots
        break;
      default:
        bulletColor = '#ff4444';
    }
  } else {
    bulletColor = '#ff4444'; // Default red if bot not found
  }

  // Draw the bullet as a small circle
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  ctx.save();
  ctx.fillStyle = bulletColor;
  ctx.strokeStyle = '#ffffff'; // White outline
  ctx.lineWidth = 1;

  // Draw bullet body
  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw bullet trail (small line in direction of movement)
  const trailLength = 8;
  const trailEndX = screenPos.x - bullet.direction.x * trailLength;
  const trailEndY = screenPos.y - bullet.direction.y * trailLength;

  ctx.strokeStyle = bulletColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(screenPos.x, screenPos.y);
  ctx.lineTo(trailEndX, trailEndY);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw multiplayer status information
 */
function drawMultiplayerStatus(): void {
  if (!getGameController().isMultiplayerEnabled()) {
    return;
  }

  const status = getPlayerNetwork().getConnectionStatus();
  const localPlayer = getPlayerNetwork().getLocalPlayerInfo();
  const bots = getGameController().getBots();

  // Start drawing from a safe position that won't overlap with other UI
  let yOffset = 60;
  const xPos = 15;
  const lineHeight = 18;

  // Draw connection status
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = status.connected ? '#00ff00' : '#ff0000';
  ctx.font = '12px dejavu sans mono';

  const statusText = status.connected ? 'CONNECTED' : 'DISCONNECTED';
  ctx.fillText(`MP: ${statusText}`, xPos, yOffset);
  yOffset += lineHeight;

  // Draw player count
  ctx.fillStyle = '#00ff00';
  ctx.fillText(`Players: ${status.playerCount}`, xPos, yOffset);
  yOffset += lineHeight;

  // Draw bot count and status
  if (bots.size > 0) {
    ctx.fillStyle = '#ff4444'; // Red for bots
    ctx.fillText(`Bots: ${bots.size}`, xPos, yOffset);
    yOffset += lineHeight;

    // Show bot types
    const botTypes = new Map<string, number>();
    for (const bot of bots.values()) {
      const type = bot.botType || 'unknown';
      botTypes.set(type, (botTypes.get(type) || 0) + 1);
    }

    for (const [type, count] of botTypes.entries()) {
      ctx.fillStyle = '#ff4444';
      ctx.fillText(`  ${type}: ${count}`, xPos, yOffset);
      yOffset += lineHeight;
    }
  }

  // Draw local player info
  ctx.fillStyle = '#00ff00';
  ctx.fillText(`You: ${localPlayer.name}`, xPos, yOffset);
  yOffset += lineHeight;

  // Draw multiplayer mode indicator
  ctx.fillStyle = '#00ff00';
  const asteroidCount = getGameController().getCurrAsteroidCount();
  ctx.fillText(`Asteroids: ${asteroidCount} (MP Mode)`, xPos, yOffset);
  yOffset += lineHeight;

  // Show mock mode indicator if using mock players
  const otherPlayers = getPlayerNetwork().getOtherPlayers();
  const hasMockPlayers = otherPlayers.some((p) => p.id.startsWith('mock-'));
  if (hasMockPlayers) {
    ctx.fillStyle = '#ffff00'; // Yellow for mock mode
    ctx.fillText(`MOCK MODE - Demo Players`, xPos, yOffset);
    yOffset += lineHeight;
  }

  // Show additional debug info if multiplayer debug is enabled
  if (MULTIPLAYER_DEBUG) {
    ctx.fillStyle = '#00ffff'; // Cyan for debug info
    ctx.fillText(`DEBUG: Players: ${otherPlayers.length}`, xPos, yOffset);
    yOffset += lineHeight;

    // Show each player's position and state (limit to prevent overflow)
    const maxPlayersToShow = 5;
    let playersShown = 0;
    for (const player of otherPlayers) {
      if (playersShown >= maxPlayersToShow) {
        ctx.fillText(
          `... and ${otherPlayers.length - maxPlayersToShow} more`,
          xPos,
          yOffset,
        );
        break;
      }
      ctx.fillText(
        `${player.name}: (${Math.round(player.position.x)}, ${Math.round(player.position.y)}) - ${player.dead ? 'DEAD' : 'ALIVE'}`,
        xPos,
        yOffset,
      );
      yOffset += lineHeight;
      playersShown++;
    }

    // Show bot debug info
    if (bots.size > 0) {
      yOffset += lineHeight;
      ctx.fillStyle = '#ff8888'; // Light red for bot debug
      ctx.fillText(`DEBUG: Bots: ${bots.size}`, xPos, yOffset);
      yOffset += lineHeight;

      // Show each bot's position and behavior (limit to prevent overflow)
      const maxBotsToShow = 3;
      let botsShown = 0;
      for (const bot of bots.values()) {
        if (botsShown >= maxBotsToShow) {
          ctx.fillText(
            `... and ${bots.size - maxBotsToShow} more bots`,
            xPos,
            yOffset,
          );
          break;
        }
        ctx.fillText(
          `${bot.name}: (${Math.round(bot.position.x)}, ${Math.round(bot.position.y)}) - ${bot.behaviorState}`,
          xPos,
          yOffset,
        );
        yOffset += lineHeight;
        botsShown++;
      }
    }
  }
}

function drawGameCanvas(
  ship: Ship,
  roidBelt: RoidBelt,
  currScore: number,
  personalBest: number,
  textAlpha: number,
  text: string,
): void {
  try {
    // Log the start of frame drawing
    drawSpace();
    roidBelt.spawnRoids(ship);

    if (DEBUG) {
      drawDebugFeatures(ship);
    }

    drawRoidsRelative(ship, roidBelt.roids);
    drawLasers(ship);

    // Draw other players if multiplayer is enabled
    drawOtherPlayers(ship);

    drawScores(currScore, personalBest);
    drawLives(ship);

    // Draw multiplayer status
    drawMultiplayerStatus();

    if (textAlpha >= 0) {
      drawGameText(textAlpha, text);
    } else if (ship.dead) {
      showGameOverMenu();
    }
  } catch (error) {
    logError('CANVAS', 'Error in drawGameCanvas', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shipPos: { x: ship.position.x, y: ship.position.y },
    });
  }
}

export { drawSpace, drawGameCanvas };
