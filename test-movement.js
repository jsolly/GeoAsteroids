// Simple test script to verify ship movement
console.log('Testing ship movement system...');

// Mock constants
const GAME = { FPS: 60, FRICTION: 0.98 };
const SHIP = { THRUST: 0.5, MAX_VELOCITY: 10, SIZE: 20 };

// Mock ship object
const ship = {
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  angle: Math.PI / 2, // 90 degrees
  angularVelocity: 0,
  thrusting: false
};

// Mock movement functions
function addVectors(v1, v2) {
  return { x: v1.x + v2.x, y: v1.y + v2.y };
}

function multiplyVelocity(velocity, factor) {
  return { x: velocity.x * factor, y: velocity.y * factor };
}

function addPositionAndVelocity(position, velocity) {
  return { x: position.x + velocity.x, y: position.y + velocity.y };
}

// Test movement update
function updateMovement() {
  // Apply angular velocity to rotation
  ship.angle += ship.angularVelocity;

  // Apply thrust if thrusting
  if (ship.thrusting) {
    const thrust = {
      x: (Math.cos(ship.angle) * SHIP.THRUST) / GAME.FPS,
      y: (-Math.sin(ship.angle) * SHIP.THRUST) / GAME.FPS,
    };
    ship.velocity = addVectors(ship.velocity, thrust);

    // Cap velocity to prevent excessive speed
    const currentSpeed = Math.sqrt(
      ship.velocity.x * ship.velocity.x + ship.velocity.y * ship.velocity.y
    );
    if (currentSpeed > SHIP.MAX_VELOCITY) {
      const scale = SHIP.MAX_VELOCITY / currentSpeed;
      ship.velocity.x *= scale;
      ship.velocity.y *= scale;
    }
  } else {
    // Apply friction
    ship.velocity = multiplyVelocity(ship.velocity, 1 - GAME.FRICTION / GAME.FPS);
  }

  // Update position based on velocity
  ship.position = addPositionAndVelocity(ship.position, ship.velocity);
}

// Test scenarios
console.log('Initial ship state:', JSON.stringify(ship, null, 2));

// Test 1: Rotation
console.log('\n--- Test 1: Rotation ---');
ship.angularVelocity = 0.1; // Turn left
updateMovement();
console.log('After rotation:', JSON.stringify(ship, null, 2));

// Test 2: Thrust
console.log('\n--- Test 2: Thrust ---');
ship.thrusting = true;
updateMovement();
console.log('After thrust:', JSON.stringify(ship, null, 2));

// Test 3: Multiple updates
console.log('\n--- Test 3: Multiple updates ---');
for (let i = 0; i < 5; i++) {
  updateMovement();
  console.log(`Update ${i + 1}:`, JSON.stringify(ship, null, 2));
}

console.log('\nMovement system test completed!');
