import { CTX, CVS, SHIP_SIZE } from './config.js';
import { Ship } from './ship.js';

/**
 * Draw lasers from an array on the canvas
 */
function drawLasers(ship: Ship): void {
  for (const laser of ship.lasers) {
    const ly = laser.centroid.y;
    const lx = laser.centroid.x;
    const shipX = ship.centroid.x;
    const shipY = ship.centroid.y;
    if (laser.explodeTime == 0) {
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        lx - shipX + CVS.width / 2,
        ly - shipY + CVS.height / 2,
        SHIP_SIZE / 15,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
    } else {
      // draw explosion
      CTX.fillStyle = 'orangered';
      CTX.beginPath();
      CTX.arc(
        lx - shipX + CVS.width / 2,
        ly - shipY + CVS.height / 2,
        ship.r * 0.75,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        lx - (shipX - CVS.width),
        ly - (shipY - CVS.height),
        ship.r * 0.5,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'pink';
      CTX.beginPath();
      CTX.arc(
        lx - (shipX - CVS.width),
        ly - (shipY - CVS.height),
        ship.r * 0.25,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
    }
  }
}

export { drawLasers };
