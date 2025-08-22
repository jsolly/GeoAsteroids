# Core Gameplay Loop

## Overview
GeoAsteroids is a classic arcade-style space shooter where players navigate through asteroid fields, destroy asteroids, and engage in multiplayer combat.

## Game States

### Start State
- Main menu with multiplayer options
- Player count display
- Settings for sound and music preferences
- Debug mode access (development only)

### Main Game Loop
The core gameplay follows this sequence:

1. **Input Processing** → 2. **Game Update** → 3. **Rendering** → 4. **Collision Resolution**

#### 1. Input Processing
- Keyboard input handling (movement, shooting, EMP pulse)
- Mouse input for menu interactions
- Network input for multiplayer synchronization

#### 2. Game Update
- Ship movement and physics updates
- Asteroid movement and spawning
- Bot AI behavior and movement
- Laser projectile updates
- Health and damage calculations
- Score and level progression

#### 3. Rendering
- Canvas drawing with viewport management
- Ship, asteroid, and laser rendering
- UI elements and HUD updates
- Particle effects and explosions

#### 4. Collision Resolution
- Laser-asteroid collision detection
- Ship-asteroid collision handling
- Ship-ship collision in multiplayer
- Bot collision systems

## Win/Lose Conditions

### Win Conditions
- Complete asteroid field clearing
- Achieve target score thresholds
- Survive for specified time periods

### Lose Conditions
- Ship health reaches zero
- All lives consumed
- Ship destroyed by collision or enemy fire

## Key Systems

### Scoring System
- Points for asteroid destruction
- Bonus points for consecutive hits
- Multiplier system for high scores

### Level Progression
- Increasing asteroid counts
- Faster movement speeds
- More complex asteroid patterns

### Multiplayer Features
- Real-time player synchronization
- Bot integration for single-player testing
- Player collision and combat systems

## Timers and Cycles

### Frame Rate
- 60 FPS game loop
- Consistent timing for physics calculations
- Smooth animation and movement

### Spawn Cycles
- Asteroid spawning every 1 second
- Bot respawn after 5 seconds
- Power-up spawns at regular intervals

### Game Flow
```
Start → Menu → Game → Level Complete → Next Level → Game Over → Menu
```

## Example Gameplay Sequence
1. Player starts game from main menu
2. Ship spawns with 3 lives and full health
3. Asteroid field appears with initial asteroids
4. Player navigates, shoots asteroids, avoids collisions
5. Score increases, level progresses
6. New asteroids spawn, difficulty increases
7. Player either completes level or loses all lives
8. Return to main menu or restart game

