import { distBetweenPoints } from './utils.mjs';
import { updateScores, getCurrentLevel } from './scoreAndLevel.mjs';
import {
    ROID_NUM, ROID_SIZE, ROID_SPEED, FPS, ROID_VERTICES, ROID_JAGG,
    ROID_POINTS_LRG, ROID_POINTS_MED, ROID_POINTS_SML,
} from './constants.mjs';

function newAsteroid(x, y, r) {
    var level = getCurrentLevel();
    var lvlMult = 1 + 0.1 * level;
    var roid = {
        x: x,
        y: y,
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

var roids, roidsTotal, roidsLeft;
function createAsteroidBelt(canv, ship) {
    var current_level = getCurrentLevel()
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
function drawAsteroids(ctx, show_bounding = false) {
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
        if (show_bounding) {
            ctx.strokeStyle = "lime";
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2, false);
            ctx.stroke();
        }
    }

}

export { createAsteroidBelt, destroyAsteroid, drawAsteroids }