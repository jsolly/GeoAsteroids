import { distBetweenPoints } from './utils.mjs';
import { updateScores, getCurrentLevel } from './scoreLevelLives.mjs';
import {
    ROID_NUM, ROID_SIZE, ROID_SPEED, FPS, ROID_VERTICES, ROID_JAGG,
    ROID_POINTS_LRG, ROID_POINTS_MED, ROID_POINTS_SML, DEBUG,
} from './constants.mjs';
import { getCanv, getCTX } from './canvas.mjs';
import { getShip } from './ship.mjs';

var roids, roidsTotal, roidsLeft;
function newAsteroid(x, y, r) {
    var level = getCurrentLevel();
    var lvlMult = 1 + 0.1 * level;
    var roid = {
        x: x,
        y: y,
        t:0,
        xv: Math.random() * ROID_SPEED * lvlMult / FPS * (Math.random() < 0.5 ? 1 : -1),
        yv: Math.random() * ROID_SPEED * lvlMult / FPS * (Math.random() < 0.5 ? 1 : -1),
        a: Math.random() * Math.PI * 2, // in radians
        r: r,
        offsets: [],
        vertices: Math.floor(Math.random() * (ROID_VERTICES + 1) + ROID_VERTICES / 2),
    }
    for (var i = 0; i < roid.vertices; i++) {
        roid.offsets.push(Math.random() * ROID_JAGG * 2 + 1 - ROID_JAGG);
    }

    return roid;
}

function getRoidsInfo() {
    return { "roids": roids, "roidsLeft": roidsLeft, "roidsTotal": roidsTotal }
}


function createAsteroidBelt() {
    let canv = getCanv();
    let ship = getShip();
    let current_level = getCurrentLevel()
    roids = [];
    roidsTotal = (ROID_NUM + current_level) * 7
    roidsLeft = roidsTotal
    var x, y;
    for (var i = 0; i < ROID_NUM + current_level; i++) {
        // random asteroid location (not touching ship)
        do {
            x = Math.floor(Math.random() * canv.width);
            y = Math.floor(Math.random() * canv.height);
        } while (distBetweenPoints(ship.x, ship.y, x, y) < ROID_SIZE * 2 + ship.r);
        roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 2), current_level, FPS));
    }
    return { "roids": roids, "roidsLeft": roidsLeft, "roidsTotal": roidsTotal }

}

function destroyAsteroid(i, roids) {
    var x = roids[i].x
    var y = roids[i].y
    var r = roids[i].r
    var score = 0;

    // split the asteroid if applicable
    if (r == Math.ceil(ROID_SIZE / 2)) { // large asteroid
        roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 4)));
        roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 4)));
        score += ROID_POINTS_LRG
    } else if (r == Math.ceil(ROID_SIZE / 4)) { // medium asteroid
        roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 8)));
        roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 8)));
        score += ROID_POINTS_MED
    } else {
        score += ROID_POINTS_SML
    }
    updateScores(score)
    roids.splice(i, 1);
    roidsLeft--;
}


var x, y, r, a, vertices, offsets
function drawAsteroids() {
    let ctx = getCTX();
    for (var i = 0; i < roids.length; i++) {
        ctx.strokeStyle = "slategrey";
        ctx.lineWidth = 1.5;
        // get asteroid properties
        x = roids[i].x;
        y = roids[i].y;
        r = roids[i].r;
        a = roids[i].a;
        vertices = roids[i].vertices;
        offsets = roids[i].offsets
        // draw a path
        ctx.beginPath();
        ctx.moveTo(
            x + r * offsets[0] * Math.cos(a),
            y + r * offsets[0] * Math.sin(a)
        )
        // draw the polygon
        for (var j = 1; j < vertices; j++) {
            ctx.lineTo(
                x + r * offsets[j] * Math.cos(a + j * Math.PI * 2 / vertices),
                y + r * offsets[j] * Math.sin(a + j * Math.PI * 2 / vertices)
            );
        }
        ctx.closePath();
        ctx.stroke();
        // show asteroid's collision circle
        if (DEBUG) {
            ctx.strokeStyle = "lime";
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2, false);
            ctx.stroke();
        }
    }

}

function drawAsteroidsRelative(ship) {
    let ctx = getCTX();
    let cvs = getCanv();
    for (var i = 0; i < roids.length; i++) {
        ctx.strokeStyle = "slategrey";
        ctx.lineWidth = 1.5;
        // get asteroid properties
        x = -(ship.x-cvs.width/2)+roids[i].x;
        y = -(ship.y-cvs.height/2) +roids[i].y;
        r = roids[i].r;
        a = roids[i].a;
        vertices = roids[i].vertices;
        offsets = roids[i].offsets
        // draw a path
        ctx.beginPath();
        ctx.moveTo(
            x + r * offsets[0] * Math.cos(a),
            y + r * offsets[0] * Math.sin(a)
        )
        // draw the polygon
        for (var j = 1; j < vertices; j++) {
            ctx.lineTo(
                x + r * offsets[j] * Math.cos(a + j * Math.PI * 2 / vertices),
                y + r * offsets[j] * Math.sin(a + j * Math.PI * 2 / vertices)
            );
        }
        ctx.closePath();
        ctx.stroke();
        // show asteroid's collision circle
        if (DEBUG) {
            ctx.strokeStyle = "lime";
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2, false);
            ctx.stroke();
        }
    }
}

function moveAsteroids(){
    let canv = getCanv();
    let ship = getShip();
    for (var i = 0; i < roids.length; i++) {
        // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
        // let dt = 1/Math.sqrt(1-beta_squared)
        roids[i].x += roids[i].xv;
        roids[i].y += roids[i].yv;
        // handle edge of screen
        // if (roids[i].x < 0 - roids[i].r) {
        //     roids[i].x = canv.width + roids[i].r;
        // } else if (roids[i].x > canv.width + roids[i].r) {
        //     roids[i].x = 0 + roids[i].r;
        // }

        // if (roids[i].y < 0 - roids[i].r) {
        //     roids[i].y = canv.height + roids[i].r;
        // } else if (roids[i].y > canv.height + roids[i].r) {
        //     roids[i].y = 0 + roids[i].r;
        // }
    }
}

export { createAsteroidBelt, destroyAsteroid, drawAsteroids, drawAsteroidsRelative, getRoidsInfo, moveAsteroids }