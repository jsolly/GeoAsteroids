// Test script to reproduce respawn issue
// This script will force a ship to take damage after spawn protection ends

console.log('Testing respawn issue...');

// Wait for game to load
setTimeout(() => {
  const gameController = window.gameController;
  if (!gameController) {
    console.error('Game controller not found');
    return;
  }

  const localPlayer = gameController.getCurrPlayer();
  if (!localPlayer) {
    console.error('Local player not found');
    return;
  }

  const ship = localPlayer.ship;
  console.log('Initial ship state:', {
    health: ship.health,
    exploding: ship.exploding,
    blinkCount: ship.blinkCount,
    spawnProtectionTimer: ship.spawnProtectionTimer
  });

  // Wait for spawn protection to end
  const checkSpawnProtection = () => {
    if (ship.blinkCount > 0) {
      console.log('Still under spawn protection:', {
        blinkCount: ship.blinkCount,
        spawnProtectionTimer: ship.spawnProtectionTimer
      });
      setTimeout(checkSpawnProtection, 100);
    } else {
      console.log('Spawn protection ended, forcing damage...');
      
      // Force damage to ship
      ship.takeDamage(100, 'test');
      
      console.log('After damage:', {
        health: ship.health,
        exploding: ship.exploding,
        blinkCount: ship.blinkCount,
        spawnProtectionTimer: ship.spawnProtectionTimer
      });

      // Check if ship respawns after explosion
      setTimeout(() => {
        console.log('After explosion time:', {
          health: ship.health,
          exploding: ship.exploding,
          blinkCount: ship.blinkCount,
          spawnProtectionTimer: ship.spawnProtectionTimer
        });
      }, 2000);
    }
  };

  checkSpawnProtection();
}, 2000);
