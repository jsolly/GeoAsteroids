import { getCanv, getCTX } from './canvas.mjs';
import { SHIP_SIZE, LASER_SPEED, LASER_MAX, LASER_DIST, FPS } from './constants.mjs';
import { getShip } from './ship.mjs';
import { fxLaser } from './soundsMusic.mjs';
import { handleLaserEdgeofScreen } from './collisions.mjs';


function shootLaser() {
    let ship = getShip();
    // Create laser object
    if (ship.canShoot && ship.lasers.length < LASER_MAX) {
        ship.lasers.push({
            x: ship.x + 4 / 3 * ship.r * Math.cos(ship.a),
            y: ship.y - 4 / 3 * ship.r * Math.sin(ship.a),
            xv: LASER_SPEED * Math.cos(ship.a) / FPS,
            yv: - LASER_SPEED * Math.sin(ship.a) / FPS,
            distTraveled: 0,
            explodeTime: 0
        });
        fxLaser.play();
    }
    // prevent further shooting
    ship.canShoot = false;
}

function drawLasers() {
    let ship = getShip();
    let ctx = getCTX();
    for (var i = 0; i < ship.lasers.length; i++) {
        if (ship.lasers[i].explodeTime == 0) {
            ctx.fillStyle = "salmon";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, SHIP_SIZE / 15, 0, Math.PI * 2, false);
            ctx.fill();

        } else {
            // draw explosion
            ctx.fillStyle = "orangered";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, ship.r * 0.75, 0, Math.PI * 2, false);
            ctx.fill();
            ctx.fillStyle = "salmon";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, ship.r * 0.5, 0, Math.PI * 2, false);
            ctx.fill();
            ctx.fillStyle = "pink";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, ship.r * 0.25, 0, Math.PI * 2, false);
            ctx.fill();
        }
    }
}

function moveLasers(){
    let canv = getCanv();
    let ship = getShip();
    for (var i = ship.lasers.length - 1; i >= 0; i--) {
        // check laser distance
        if (ship.lasers[i].distTraveled > LASER_DIST * canv.width) {
            ship.lasers.splice(i, 1);
            continue;
        } 

        // handle the explosion
        if (ship.lasers[i].explodeTime > 0) {
            ship.lasers[i].explodeTime--;

            if (ship.lasers[i].explodeTime == 0) {
                ship.lasers.splice(i, 1);
                continue;
            }

        } else {
            ship.lasers[i].x += ship.lasers[i].xv;
            ship.lasers[i].y += ship.lasers[i].yv;

            // calculate distance traveled 
            ship.lasers[i].distTraveled += Math.sqrt(Math.pow(ship.lasers[i].xv, 2) + Math.pow(ship.lasers[i].yv, 2));
            handleLaserEdgeofScreen(i);
        }
    }
}


export { drawLasers, shootLaser, moveLasers }