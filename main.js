import {
    SHIP_SIZE, SHIP_INV_DUR, SHIP_INV_BLINK_DUR, SHIP_EXPLODE_DUR, SHIP_THRUST, TURN_SPEED,
    FPS, START_LEVEL, 
    MUSIC_ON, SOUND_ON,
    SHOW_BOUNDING, FRICTION, SHOW_CENTRE_DOT, TEXT_SIZE,
    LASER_MAX, LASER_SPEED, LASER_DIST, LASER_EXPLODE_DUR
} from './modules/constants.mjs';
import { distBetweenPoints } from './modules/utils.mjs';
import { createAsteroidBelt, drawAsteroids, destroyAsteroid } from './modules/asteroid.mjs';
import { getCurrentHighScore, drawScores, newLevel } from './modules/scoreAndLevel.mjs';

//** @type {HTMLCanvasElement} */
canv = document.getElementById("gameCanvas");
ctx = canv.getContext("2d");


// set up sound effects 
var maxStreams, vol;
var fxThrust = new Sound("sounds/thrust.m4a", maxStreams = 1, vol = 0.05);
var fxHit = new Sound("sounds/hit.m4a", maxStreams = 5, vol = 0.05);
var fxExplode = new Sound("sounds/explode.m4a", maxStreams = 1, vol = 0.05);
var fxLaser = new Sound("sounds/laser.m4a", maxStreams = 5, vol = 0.05);

// set up the music
var music = new Music("sounds/music-low.m4a", "sounds/music-high.m4a")

// setup the game parameters

var ship, canv, ctx, roids, roidBelt, roidsLeft, roidsTotal, textAlpha, lives
newGame();
function newGame() {
    ship = newShip();
    getCurrentHighScore();
    roidBelt = createAsteroidBelt(canv, ship);
    roids = roidBelt.roids
    roidsLeft = roidBelt.roidsLeft
    roidsTotal = roidBelt.roidsTotal

}

function gameOver() {
    ship.dead = true;
    text = "Game Over";
    textAlpha = 1.0;
    music.tempo = 1.0;

}

document.addEventListener("keydown", keyDown);
document.addEventListener("keyup", keyUp);
const toggleMusicButton = document.getElementById("toggle-music");
const toggleSoundButton = document.getElementById("toggle-sound");
toggleSoundButton.addEventListener("click", toggleMusic)
toggleMusicButton.addEventListener("click", toggleSound)
// Set up game loop
setInterval(update, 1000 / FPS)

function toggleSound() {
    SOUND_ON = !SOUND_ON
    document.getElementById("toggle-sound").blur();
}

function toggleMusic() {
    MUSIC_ON = !MUSIC_ON
    document.getElementById("toggle-music").blur();

}

function drawShip(x, y, a, color = "white") {
    ctx.strokeStyle = color;
    ctx.lineWidth = SHIP_SIZE / 20;
    ctx.beginPath();
    ctx.moveTo( // nose of ship
        x + 4 / 3 * ship.r * Math.cos(a),
        y - 4 / 3 * ship.r * Math.sin(a)
    );
    ctx.lineTo( // rear left
        x - ship.r * (2 / 3 * Math.cos(a) + Math.sin(a)),
        y + ship.r * (2 / 3 * Math.sin(a) - Math.cos(a))
    );
    ctx.lineTo( // rear right
        x - ship.r * (2 / 3 * Math.cos(a) - Math.sin(a)),
        y + ship.r * (2 / 3 * Math.sin(a) + Math.cos(a))
    )
    ctx.closePath();
    ctx.stroke();
}

function explodeShip() {
    ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS)
    fxExplode.play()
}

function keyDown(/** @type {KeyboardEvent} */ ev) {
    if (ship.dead) {
        return;
    }
    switch (ev.keyCode) {
        case 32: // Shoot laser
            shootLaser();
            break;

        case 37: // left arrow (rotate ship left)
            ship.rot = TURN_SPEED / 180 * Math.PI / FPS
            break;
        case 38: // up arrow (thrust the ship forward)
            ship.thrusting = true
            break;
        case 39: // right arrow (rotate ship right)
            ship.rot = -TURN_SPEED / 180 * Math.PI / FPS
            break;
    }
}


function keyUp(/** @type {KeyboardEvent} */ ev) {
    if (ship.dead) {
        return;
    }
    switch (ev.keyCode) {
        case 32: // Allow shooting
            ship.canShoot = true
            break;
        case 37: // Release left arrow. (stop rotating ship left)
            ship.rot = 0
            break;
        case 38: // Release up arrow. (stop thrusting the ship forward)
            ship.thrusting = false
            break;
        case 39: // Release right arrow (stop rotating ship right)
            ship.rot = 0
            break;
    }
}

function newShip() {
    return {
        x: canv.width / 2,
        y: canv.height / 2,
        r: SHIP_SIZE / 2,
        a: 90 / 180 * Math.PI, // convert to radians
        blinkCount: Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR),
        blinkTime: Math.ceil(SHIP_INV_BLINK_DUR * FPS),
        canShoot: true,
        dead: false,
        lasers: [],
        explodeTime: 0,
        rot: 0,
        thrusting: false,
        thrust: {
            x: 0,
            y: 0
        }
    }
}

function shootLaser() {
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

function Music(srcLow, srcHigh) {
    this.soundLow = new Audio(srcLow);
    this.soundHigh = new Audio(srcHigh);
    this.low = true;
    this.tempo = 1.0; // seconds per beat
    this.beatTime = 0; // the frames left before next beat

    this.play = function () {
        if (this.low) {
            this.soundLow.play()
        } else {
            this.soundHigh.play()
        }
        this.low = !this.low;
    }
    this.setAsteroidRatio = function (ratio) {
        this.tempo = 1.0 - 0.75 * (1.0 - ratio);

    }

    this.tick = function () {
        if (this.beatTime == 0) {
            this.play();
            this.beatTime = Math.ceil(this.tempo * FPS);

        } else {
            this.beatTime--;
        }
    }
}

function Sound(src, maxStreams = 1, vol = 0.05) {
    this.streamNum = 0;
    this.streams = [];
    for (var i = 0; i < maxStreams; i++) {
        this.streams.push(new Audio(src));
        this.streams[i].volume = vol;

    }
    this.play = function () {
        if (SOUND_ON) {
            this.streamNum = (this.streamNum + 1) % maxStreams;
            this.streams[this.streamNum].play();
        }
    }
    this.stop = function () {
        this.streams[this.streamNum].pause();
        this.streams[this.streamNum].currentTime = 0;
    }
}


function update() {
    var blinkOn = ship.blinkCount % 2 == 0;
    var exploding = ship.explodeTime > 0;

    // tick the music
    if (MUSIC_ON) {
        music.tick();
    }

    // draw space
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canv.width, canv.height);

    // draw the asteroids
    drawAsteroids(ctx);


    // Thrust ship
    if (ship.thrusting && !ship.dead) {
        ship.thrust.x += SHIP_THRUST * Math.cos(ship.a) / FPS;
        ship.thrust.y -= SHIP_THRUST * Math.sin(ship.a) / FPS;
        fxThrust.play();

        // draw the thruster
        if (!exploding && blinkOn) {
            ctx.fillStyle = "red";
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = SHIP_SIZE / 10;
            ctx.beginPath();
            ctx.moveTo( // rear left
                ship.x - ship.r * (2 / 3 * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
                ship.y + ship.r * (2 / 3 * Math.sin(ship.a) - 0.5 * Math.cos(ship.a))
            );
            ctx.lineTo( // rear center (behind ship)
                ship.x - ship.r * 5 / 3 * Math.cos(ship.a),
                ship.y + ship.r * 5 / 3 * Math.sin(ship.a)
            );
            ctx.lineTo( // rear right
                ship.x - ship.r * (2 / 3 * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
                ship.y + ship.r * (2 / 3 * Math.sin(ship.a) + 0.5 * Math.cos(ship.a))
            )
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    } else {
        // apply friction when ship not thrusting
        ship.thrust.x -= FRICTION * ship.thrust.x / FPS;
        ship.thrust.y -= FRICTION * ship.thrust.y / FPS;
        fxThrust.stop();
    }

    // draw triangular ship
    if (!exploding) {
        if (blinkOn && !ship.dead) {
            drawShip(ship.x, ship.y, ship.a);
        }
        // handle blinking
        if (ship.blinkCount > 0) {
            // reduce blink time
            ship.blinkTime--;

            // reduce blink count
            if (ship.blinkTime == 0) {
                ship.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
                ship.blinkCount--;
            }
        }
    } else {
        // draw explosion
        ctx.fillStyle = "darkred";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.7, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.4, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = "Orange";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.1, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = "Yellow";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 0.8, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.fillStyle = "White";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 0.5, 0, Math.PI * 2, false);
        ctx.fill();
    }

    // Draw collision bounding box (if needed)
    if (SHOW_BOUNDING) {
        ctx.strokeStyle = "lime";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2, false);
        ctx.stroke();
    }

    // show ship's centre dot
    if (SHOW_CENTRE_DOT) {
        ctx.fillStyle = "red";
        ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
    }

    // draw lasers
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

    // draw game text
    if (textAlpha >= 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255, " + textAlpha + ")";
        ctx.font = "small-caps " + TEXT_SIZE + "px dejavu sans mono";
        ctx.fillText(text, canv.width / 2, canv.height * 3 / 4);
        textAlpha -= (1.0 / TEXT_FADE_TIME / FPS);
    } else if (ship.dead) {
        newGame();
    }
    // draw the lives
    var lifeColor;
    for (var i = 0; i < lives; i++) {
        lifeColor = exploding && i == lives - 1 ? "red" : "white";
        drawShip(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE, 0.5 * Math.PI, lifeColor);

    }
    drawScores(ctx, canv);

    // detect laser hits on asteroids
    var ax, ay, ar, lx, ly, ly;
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
                    roidBelt = createAsteroidBelt(canv, ship);
                    roids = roidBelt.roids
                    roidsLeft = roidBelt.roidsLeft
                    roidsTotal = roidBelt.roidsTotal
                }
                ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS)
                // calculate remianing ratio of remaining asteroids to determine music tempo
                music.setAsteroidRatio(roidsLeft == 0 ? 1 : roidsLeft / roidsTotal)
            }
        }

    }

    // check for asteroid collisions (when not exploding)
    if (!exploding) {

        // only check when not blinking
        if (ship.blinkCount == 0 && !ship.dead) {
            for (var i = 0; i < roids.length; i++) {
                if (distBetweenPoints(ship.x, ship.y, roids[i].x, roids[i].y) < ship.r + roids[i].r) {
                    explodeShip();
                    destroyAsteroid(i, roids);
                    fxHit.play();
                    
                    if (roids.length == 0) {
                        newLevel();
                        roidBelt = createAsteroidBelt(canv, ship);
                        roids = roidBelt.roids
                        roidsLeft = roidBelt.roidsLeft
                        roidsTotal = roidBelt.roidsTotal
                    }
                    // calculate remianing ratio of remaining asteroids to determine music tempo
                    music.setAsteroidRatio(roidsLeft == 0 ? 1 : roidsLeft / roidsTotal)
                    break;
                }
            }
        }


        // rotate ship
        ship.a += ship.rot;

        // move the ship
        ship.x += ship.thrust.x;
        ship.y += ship.thrust.y;
    } else {
        // reduce explode time
        ship.explodeTime--;

        // reset ship after explosion has finished
        if (ship.explodeTime == 0) {
            lives--;
            if (lives == 0) {
                gameOver();
            } else {
                ship = newShip();
            }
        }
    }

    // handle edge of screen
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

    // move the lasers
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
    }

    // move the asteroids
    for (var i = 0; i < roids.length; i++) {
        roids[i].x += roids[i].xv;
        roids[i].y += roids[i].yv;
        // handle edge of screen
        if (roids[i].x < 0 - roids[i].r) {
            roids[i].x = canv.width + roids[i].r;
        } else if (roids[i].x > canv.width + roids[i].r) {
            roids[i].x = 0 + roids[i].r;
        }

        if (roids[i].y < 0 - roids[i].r) {
            roids[i].y = canv.height + roids[i].r;
        } else if (roids[i].y > canv.height + roids[i].r) {
            roids[i].y = 0 + roids[i].r;
        }
    }
}