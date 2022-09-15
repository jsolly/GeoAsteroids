import { CTX, CVS, SHIP_SIZE } from './config.js';
import { Ship } from './ship.js';

/**
 * draw the ship's thruster on the canvas
 */
function drawThruster(ship: Ship): void {
  if (!ship.exploding && ship.blinkOn) {
    CTX.fillStyle = 'red';
    CTX.strokeStyle = 'yellow';
    CTX.lineWidth = SHIP_SIZE / 10;
    CTX.beginPath();
    CTX.moveTo(
      // rear left
      CVS.width / 2 +
        ship.r * ((2 / 3) * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
      CVS.height / 2 +
        ship.r * ((2 / 3) * Math.sin(ship.a) - 0.5 * Math.cos(ship.a)),
    );
    CTX.lineTo(
      // rear CENTER (behind ship)
      CVS.width / 2 + ((ship.r * 5) / 3) * Math.cos(ship.a),
      CVS.height / 2 + ((ship.r * 5) / 3) * Math.sin(ship.a),
    );
    CTX.lineTo(
      // rear right
      CVS.width / 2 +
        ship.r * ((2 / 3) * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
      CVS.height / 2 +
        ship.r * ((2 / 3) * Math.sin(ship.a) + 0.5 * Math.cos(ship.a)),
    );
    CTX.closePath();
    CTX.fill();
    CTX.stroke();
  }
}

/**
 *
 * @param ship - The current Ship
 */
function drawShipRelative(ship: Ship): void {
  /*
    An overload of drawShip that doesn't ask for the position of the ship.
    Only the angle(a)

    Inputs:
    a(number) : The angle in radians

    Outputs:
    void

    */

  const a = ship.a;
  CTX.strokeStyle = 'white';
  CTX.lineWidth = SHIP_SIZE / 20;
  CTX.beginPath();
  CTX.moveTo(
    // nose of ship
    CVS.width / 2 + (4 / 3) * ship.r * Math.cos(a + 1.06),
    CVS.height / 2 + (4 / 3) * ship.r * Math.sin(a + 1.06),
  );
  CTX.lineTo(
    // rear left
    CVS.width / 2 +
      ship.r * ((-1 / 3) * Math.cos(a + 1.06) + Math.sin(a + 1.06)),
    CVS.height / 2 +
      ship.r * ((-1 / 3) * Math.sin(a + 1.06) - Math.cos(a + 1.06)),
  );
  CTX.lineTo(
    // rear right
    CVS.width / 2 +
      ship.r * ((-1 / 3) * Math.cos(a + 1.06) - Math.sin(a + 1.06)),
    CVS.height / 2 +
      ship.r * ((-1 / 3) * Math.sin(a + 1.06) + Math.cos(a + 1.06)),
  );
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
