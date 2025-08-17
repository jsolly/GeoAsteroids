# GeoAsteroids Coordinate System Architecture

## Overview

GeoAsteroids now uses a **unified world coordinate system** where all game entities (ship, asteroids, bots, players) move in world coordinates, and a **viewport transformation system** handles screen positioning.

## Coordinate Systems

### 1. World Coordinates

- **Origin**: (0, 0) - where the ship starts
- **Range**: Unlimited (can be negative or positive)
- **Usage**: All game logic, physics, collision detection, EMP calculations

### 2. Screen Coordinates

- **Origin**: Top-left of canvas (0, 0)
- **Range**: 0 to canvas width/height
- **Usage**: Drawing and rendering only

## Viewport Transformation

The viewport system treats the **ship as the camera center**:

```typescript
// Convert world coordinates to screen coordinates
export function worldToScreen(worldPos: Point, shipPos: Point): Point {
  return new Point(
    CVS.width / 2 - shipPos.x + worldPos.x, // Ship at screen center
    CVS.height / 2 - shipPos.y + worldPos.y,
  );
}
```

### How It Works

1. **Ship is always drawn at screen center** (CVS.width/2, CVS.height/2)
2. **Other entities are positioned relative to ship** using viewport transformation
3. **Ship movement updates world coordinates**, viewport follows automatically

## Entity Positioning

### Ship

- **Starts at world origin** (0, 0)
- **Moves in world coordinates** via velocity and thrust
- **Always appears at screen center** due to viewport transformation

### Asteroids

- **Spawn relative to ship's world position**
- **Move in world coordinates**
- **Drawn using viewport transformation**

### Bots

- **Positioned around world origin** (-200 to +200 range)
- **Move in world coordinates**
- **Drawn using viewport transformation**

### Other Players

- **Use world coordinates** for network synchronization
- **Drawn using viewport transformation**

## Benefits

### 1. Consistent EMP Targeting

- **Ship and bots use same coordinate system**
- **Distance calculations work correctly**
- **EMP affects entities within actual world radius**

### 2. Proper Viewport Following

- **Ship movement creates smooth scrolling effect**
- **Entities maintain relative positions**
- **No coordinate system mismatches**

### 3. Scalable World

- **World can extend beyond screen boundaries**
- **Entities can move anywhere in world space**
- **Viewport automatically follows ship**

## Implementation Details

### Viewport Utilities (`src/utils.ts`)

```typescript
worldToScreen(worldPos, shipPos); // World → Screen
screenToWorld(screenPos, shipPos); // Screen → World
isWorldPositionVisible(worldPos, shipPos, margin); // Visibility check
```

### Drawing Functions

All drawing functions now use viewport transformation:

- `drawShipRelative()` - Ship at screen center
- `drawRoidsRelative()` - Asteroids relative to ship
- `drawBotShip()` - Bots relative to ship
- `drawOtherPlayerShip()` - Players relative to ship

### Coordinate Initialization

- **Ship**: Starts at (0, 0) in world coordinates
- **Bots**: Positioned around world origin
- **Asteroids**: Spawn relative to ship's world position

## Migration from Old System

### What Changed

1. **Ship respawn**: Now uses world origin (0, 0) instead of canvas center
2. **Bot positioning**: Now uses world coordinates instead of canvas coordinates
3. **Drawing**: All entities use viewport transformation

### What Stayed the Same

1. **Ship movement**: Still updates world coordinates correctly
2. **Collision detection**: Still uses world coordinates
3. **Physics**: Still operates in world space

## Testing the New System

1. **Start new game** - Ship starts at world origin
2. **Move ship** - World coordinates update, viewport follows
3. **Use EMP** - Now correctly targets bots within world radius
4. **Observe viewport** - Smooth scrolling as ship moves

## Debugging

### Check World Coordinates

```javascript
// In browser console
gameController.getCurrShip().centroid; // Ship world position
gameController.getBots(); // Bot world positions
```

### Check Screen Coordinates

```javascript
// Viewport transformation
worldToScreen(worldPos, shipPos); // Convert to screen
```

### Common Issues

1. **Entities not visible**: Check if they're within viewport bounds
2. **EMP not working**: Verify ship and target are in same world area
3. **Jumpy movement**: Ensure consistent coordinate updates

## Future Enhancements

1. **World boundaries** - Limit world size for performance
2. **Chunked rendering** - Only render visible world areas
3. **Mini-map** - Show world overview with ship position
4. **Zoom levels** - Adjustable viewport zoom
