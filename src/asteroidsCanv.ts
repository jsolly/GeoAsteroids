import { CTX, CVS, DEBUG } from './config';
import { GameController } from './gameController';
const gameController = GameController.getInstance();

function drawRoidsRelative(): void {
  const ship = gameController.getCurrShip();
  const roids = gameController.getCurrRoidBelt().getRoids();
  for (const roid of roids) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    const x = CVS.width / 2 - ship.centroid.x + roid.centroid.x;
    const y = CVS.height / 2 - ship.centroid.y + roid.centroid.y;
    const r = roid.r;
    const a = roid.a;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
    // draw a path
    CTX.beginPath();
    CTX.moveTo(
      x + r * offsets[0] * Math.cos(a),
      y + r * offsets[0] * Math.sin(a),
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      CTX.lineTo(
        x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices),
        y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices),
      );
    }
    CTX.closePath();
    CTX.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      CTX.strokeStyle = 'lime';
      CTX.beginPath();
      CTX.arc(x, y, r, 0, Math.PI * 2, false);
      CTX.stroke();
    }
  }
}
export { drawRoidsRelative };
