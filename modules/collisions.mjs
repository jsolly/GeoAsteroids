import { LASER_EXPLODE_DUR, FPS } from './constants.mjs';
import { destroyAsteroid, createAsteroidBelt, getRoidsInfo } from './asteroids.mjs';
import { getShip } from './ship.mjs';
import { newLevel } from './scoreLevelLives.mjs';
import { distBetweenPoints } from './utils.mjs';
import { fxHit, music } from './soundsMusic.mjs';
import { update } from '../main.js';
import { getCanv } from './canvas.mjs';
// detect laser hits on asteroids
var ax, ay, ar, lx, ly, ly;
function detectLaserHits() {

    let ship = getShip();
    let roids = getRoidsInfo().roids
    for (var i = roids.length - 1; i >= 0; i--) {

        //grab asteroid properties
        ax = roids[i].x;
        ay = roids[i].y;
        ar = roids[i].r;

        for (var j = ship.lasers.length - 1; j >= 0; j--) {

            // grab laser properties
            lx = ship.lasers[j].x;
            ly = ship.lasers[j].y;

            // detect hits
            if (ship.lasers[j].explodeTime == 0 && distBetweenPoints(ax, ay, lx, ly) < ar) {

                // remove asteroid and activate laser explosion
                destroyAsteroid(i, roids);
                fxHit.play();

                if (roids.length == 0) {
                    newLevel();
                    createAsteroidBelt();
                    update();

                }
                ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS)

                // calculate remianing ratio of remaining asteroids to determine music tempo
                music.setAsteroidRatio()
            }
        }

    }
}

function handleShipEdgeOfScreen() {
    let ship = getShip();
    let canv = getCanv();
    if (ship.x < 0 - ship.r) {
        ship.x = canv.width + ship.r;
    } else if (ship.x > canv.width + ship.r) {
        ship.x = 0 + ship.r;
    }

    if (ship.y < 0 - ship.r) {
        ship.y = canv.height + ship.r;
    } else if (ship.y > canv.height + ship.r) {
        ship.y = 0 + ship.r;
    }
}

function handleLaserEdgeofScreen(i) {
    let ship = getShip();
    let canv = getCanv();
    // handle edge of screen
    if (ship.lasers[i].x < 0) {
        ship.lasers[i].x = canv.width;
    } else if (ship.lasers[i].x > canv.width) {
        ship.lasers[i].x = 0;
    }

    if (ship.lasers[i].y < 0) {
        ship.lasers[i].y = canv.height;
    } else if (ship.lasers[i].y > canv.height) {
        ship.lasers[i].y = 0;
    }
}




export { detectLaserHits, handleShipEdgeOfScreen, handleLaserEdgeofScreen }