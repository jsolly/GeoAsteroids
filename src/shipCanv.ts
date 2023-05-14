import { CTX, CVS, SHIP_SIZE } from './config.js';
import { Ship } from './ship.js';

/**
 * Draw the ship's thruster on the canvas
 * @param ship - The current Ship
 */
function drawThruster(ship: Ship): void {
  if (!ship.exploding && ship.blinkOn) {
    const rearRight = {
      x: CVS.width / 2 + (4 / 3) * ship.r * Math.cos(ship.a + 1.06),
      y: CVS.height / 2 + (4 / 3) * ship.r * Math.sin(ship.a + 1.06),
    };

    const rearLeft = {
      x:
        CVS.width / 2 +
        ship.r * ((-1 / 3) * Math.cos(ship.a + 1.06) + Math.sin(ship.a + 1.06)),
      y:
        CVS.height / 2 +
        ship.r * ((-1 / 3) * Math.sin(ship.a + 1.06) - Math.cos(ship.a + 1.06)),
    };

    const rearCenter = {
      x: CVS.width / 2 + ((ship.r * 6) / 3) * Math.cos(ship.a),
      y: CVS.height / 2 + ((ship.r * 6) / 3) * Math.sin(ship.a),
    };

    const gradient = CTX.createLinearGradient(
      rearCenter.x,
      rearCenter.y,
      (rearLeft.x + rearRight.x) / 2,
      (rearLeft.y + rearRight.y) / 2,
    );
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.5, 'orange');
    gradient.addColorStop(1, 'yellow');

    CTX.fillStyle = gradient;
    CTX.strokeStyle = 'yellow';
    CTX.lineWidth = SHIP_SIZE / 20;
    CTX.beginPath();
    CTX.moveTo(rearLeft.x, rearLeft.y);
    CTX.lineTo(rearCenter.x, rearCenter.y);
    CTX.lineTo(rearRight.x, rearRight.y);
    CTX.closePath();
    CTX.fill();
    CTX.stroke();
  }
}

/**
 * Draw ship relative to its angle
 * @param ship - The current Ship
 */
function drawShipRelative(ship: Ship): void {
  const { a } = ship;
  const nose = {
    x:
      CVS.width / 2 +
      ship.r * ((-1 / 3) * Math.cos(a + 1.06) - Math.sin(a + 1.06)),
    y:
      CVS.height / 2 +
      ship.r * ((-1 / 3) * Math.sin(a + 1.06) + Math.cos(a + 1.06)),
  };

  const rearRight = {
    x: CVS.width / 2 + (4 / 3) * ship.r * Math.cos(a + 1.06),
    y: CVS.height / 2 + (4 / 3) * ship.r * Math.sin(a + 1.06),
  };

  const rearLeft = {
    x:
      CVS.width / 2 +
      ship.r * ((-1 / 3) * Math.cos(a + 1.06) + Math.sin(a + 1.06)),
    y:
      CVS.height / 2 +
      ship.r * ((-1 / 3) * Math.sin(a + 1.06) - Math.cos(a + 1.06)),
  };

  CTX.strokeStyle = 'white';
  CTX.lineWidth = SHIP_SIZE / 20;
  CTX.beginPath();
  CTX.moveTo(nose.x, nose.y);
  CTX.lineTo(rearLeft.x, rearLeft.y);
  CTX.lineTo(rearRight.x, rearRight.y);
  CTX.closePath();
  CTX.stroke();
}

/**
 * Draw the explosion when a ship is destroyed
 */
function drawShipExplosion(ship: Ship): void {
  const x = CVS.width / 2;
  const y = CVS.height / 2;
  CTX.fillStyle = 'darkred';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 1.7, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'red';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 1.4, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'Orange';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 1.1, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'Yellow';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 0.8, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'White';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 0.5, 0, Math.PI * 2, false);
  CTX.fill();
}

export { drawShipRelative, drawShipExplosion, drawThruster };
