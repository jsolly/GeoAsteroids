import {
    SHIP_SIZE, SHIP_INV_DUR, SHIP_INV_BLINK_DUR, SHIP_EXPLODE_DUR, SHIP_THRUST,
    FPS, START_LIVES, FRICTION
} from './constants.mjs';
import { getCanv, getCTX } from './canvas.mjs';
import { fxExplode, fxThrust } from './soundsMusic.mjs';
var ship;
function getShip() {
    return ship
}
function newShip(current_lives = START_LIVES, current_blinkOn = false) {
    let canv = getCanv();
    ship = {
        x: canv.width / 2,
        y: canv.height / 2,
        t:0,
        xv:0,
        yv:0,
        r: SHIP_SIZE / 2,
        a: 90 / 180 * Math.PI, // convert to radians
        blinkCount: Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR),
        blinkTime: Math.ceil(SHIP_INV_BLINK_DUR * FPS),
        blinkOn: current_blinkOn,
        canShoot: true,
        dead: false,
        exploding: false,
        lives: current_lives,
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

function killShip() {
    ship.dead = true
}

function setBlinkOn() {
    ship.blinkOn = ship.blinkCount % 2 == 0;
}
function setExploding() {
    ship.exploding = ship.explodeTime > 0;
}

function explodeShip() {
    ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS)
    fxExplode.play()
}

function thrustShip() {
    if (ship.thrusting && !ship.dead) {
        ship.xv -= SHIP_THRUST * Math.cos(ship.a) / FPS;
        ship.yv -= SHIP_THRUST * Math.sin(ship.a) / FPS;
        fxThrust.play();

        drawThruster();
    } else {
        // apply friction when ship not thrusting
        ship.xv -= FRICTION * ship.xv / FPS;
        ship.yv -= FRICTION * ship.yv / FPS;
        fxThrust.stop();
    }
}

function moveShip() {
    // rotate ship
    ship.a += ship.rot;

    // move the ship
    ship.x += ship.xv;
    ship.y += ship.yv;
}

function drawThruster() {
    let ctx = getCTX();
    let cvs = getCanv();
    if (!ship.exploding && ship.blinkOn) {
        ctx.fillStyle = "red";
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = SHIP_SIZE / 10;
        ctx.beginPath();
        ctx.moveTo( // rear left
            cvs.width/2 + ship.r * (2 / 3 * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
            cvs.height/2 + ship.r * (2 / 3 * Math.sin(ship.a) - 0.5 * Math.cos(ship.a))
        );
        ctx.lineTo( // rear center (behind ship)
            cvs.width/2 + ship.r * 5 / 3 * Math.cos(ship.a),
            cvs.height/2 + ship.r * 5 / 3 * Math.sin(ship.a)
        );
        ctx.lineTo( // rear right
            cvs.width/2 + ship.r * (2 / 3 * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
            cvs.height/2 + ship.r * (2 / 3 * Math.sin(ship.a) + 0.5 * Math.cos(ship.a))
        )
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

function drawShip(x, y, a, color = "white") {
    let ctx = getCTX();
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

function drawShipRelative(a, color = "white") {
    /*
    An overload of drawShip that doesn't ask for the position of the ship.
    Only the angle(a)

    Inputs:
    a(number) : The angle in radians(?)
    
    Outputs:
    void

    */
    let ctx = getCTX();
    let cvs = getCanv();
    ctx.strokeStyle = color;
    ctx.lineWidth = SHIP_SIZE / 20;
    ctx.beginPath();
    ctx.moveTo( // nose of ship
        cvs.width/2 + 4 / 3 * ship.r * Math.cos(a+1.06),
        cvs.height/2 +4 / 3 * ship.r * Math.sin(a+1.06)
    );
    ctx.lineTo( // rear left
        cvs.width/2 + ship.r * (-1 / 3 * Math.cos(a+1.06) + Math.sin(a+1.06)),
        cvs.height/2 + ship.r * (-1 / 3 * Math.sin(a+1.06) - Math.cos(a+1.06))
    );
    ctx.lineTo( // rear right
        cvs.width/2 + ship.r * (-1 / 3 * Math.cos(a+1.06) - Math.sin(a+1.06)),
        cvs.height/2 + ship.r * (-1 / 3 * Math.sin(a+1.06) + Math.cos(a+1.06))
    )
    ctx.closePath();
    ctx.stroke();
}


function drawShipExplosion() {
    let ctx = getCTX();
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

export { newShip, getShip, drawShip,drawShipRelative, drawShipExplosion, explodeShip, killShip, drawThruster, thrustShip, moveShip, setBlinkOn, setExploding }