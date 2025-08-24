export const TURN_SPEED = 450; // turn speed in degrees per second
export const SHIP_MAX_HEALTH = 100; // Maximum health points for ship
export const SHIP_COLLISION_DAMAGE = 20; // Damage from any collision (roid, bot, player)
export const SHIP_HEALTH_REGEN_RATE = 1; // Health regeneration per second when not taking damage
export const SHIP_HEALTH_REGEN_DELAY = 5; // Seconds to wait before health regeneration starts
export const SHIP_THRUST = 5; // Thrust in pixels per second per second (Acceleration)
export const SHIP_MAX_VELOCITY = 8; // Maximum velocity in pixels per second (prevents excessive speed)
export const SHIP_BOT_FRICTION = 2.0; // Bot friction coefficient (higher = more friction, bots slow down faster)
export const SHIP_SIZE = 30; // ship height in pixels

// Frame-based constants for explosion and respawn timing
export const SHIP_EXPLODE_DUR_FRAMES = 18; // 0.3 seconds at 60 FPS

// Frame-based constants for invincibility timing
export const SHIP_INV_DUR_FRAMES = 180; // 3 seconds at 60 FPS
export const SHIP_INV_BLINK_DUR_FRAMES = 6; // 0.1 seconds at 60 FPS
