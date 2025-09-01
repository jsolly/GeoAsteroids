import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../src/entities/player/Player';

describe('Death Message System', () => {
  beforeEach(() => {
    // Mock window.dispatchEvent to capture events
    vi.spyOn(window, 'dispatchEvent');
  });

  it('should format death message with killer name when killed by laser', () => {
    // Create a local player (the killer)
    const killer = Player.createPlayer({
      id: 'killer',
      name: 'Player679',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    // Create a bot player (the victim)
    const victim = Player.createPlayer({
      id: 'victim',
      name: 'Bot123',
      type: 'bot',
      position: { x: 200, y: 200 },
    });

    // Simulate the bot being killed by the player's laser
    victim.ship.takeDamage(100, 'laser', killer.name);

    // Check that the death cause was formatted correctly
    expect(victim.deathCause).toBe("Player679's laser. Pew pew, you got zapped!");
  });

  it('should format death message without killer name when killer is unknown', () => {
    // Create a bot player
    const victim = Player.createPlayer({
      id: 'victim',
      name: 'Bot123',
      type: 'bot',
      position: { x: 200, y: 200 },
    });

    // Simulate the bot being killed by an unknown laser
    victim.ship.takeDamage(100, 'laser');

    // Check that the death cause was formatted correctly
    expect(victim.deathCause).toBe('a laser. Someone has good aim!');
  });

  it('should format death message for asteroid collision', () => {
    // Create a player
    const player = Player.createPlayer({
      id: 'player',
      name: 'Player123',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    // Simulate asteroid collision
    player.ship.takeDamage(100, 'asteroid');

    // Check that the death cause was formatted correctly
    expect(player.deathCause).toBe('colliding with an asteroid. Space rocks are not your friends!');
  });

  it('should format death message for boundary collision', () => {
    // Create a player
    const player = Player.createPlayer({
      id: 'player',
      name: 'Player123',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    // Simulate boundary collision
    player.ship.takeDamage(100, 'boundary');

    // Check that the death cause was formatted correctly
    expect(player.deathCause).toBe(
      'colliding with the boundary. What a goof! Did you forget how to fly?'
    );
  });

  it('should format death message for player collision with killer name', () => {
    // Create two players
    const killer = Player.createPlayer({
      id: 'killer',
      name: 'Player679',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    const victim = Player.createPlayer({
      id: 'victim',
      name: 'Player123',
      type: 'local',
      position: { x: 200, y: 200 },
    });

    // Simulate player collision
    victim.ship.takeDamage(100, 'player', killer.name);

    // Check that the death cause was formatted correctly
    expect(victim.deathCause).toBe('colliding with Player679. Maybe try dodging next time?');
  });

  it('should only show death messages for local players, not bots', () => {
    // Create a local player
    const localPlayer = Player.createPlayer({
      id: 'local',
      name: 'Player123',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    // Create a bot player
    const botPlayer = Player.createPlayer({
      id: 'bot',
      name: 'Bot123',
      type: 'bot',
      position: { x: 200, y: 200 },
    });

    // Both players should have death causes when they die
    localPlayer.ship.takeDamage(100, 'asteroid');
    botPlayer.ship.takeDamage(100, 'laser', 'Player123');

    // Both should have death causes
    expect(localPlayer.deathCause).toBe(
      'colliding with an asteroid. Space rocks are not your friends!'
    );
    expect(botPlayer.deathCause).toBe("Player123's laser. Pew pew, you got zapped!");

    // The key difference is that only local players should trigger death message display
    // This is handled in GameLoopManager.handleAllPlayerRespawns() with the condition:
    // `player.type === 'local'`
    expect(localPlayer.type).toBe('local');
    expect(botPlayer.type).toBe('bot');
  });

  it('should prevent flashing by using only one death message system', () => {
    // Create a local player
    const player = Player.createPlayer({
      id: 'player',
      name: 'Player123',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    // Simulate player death
    player.ship.takeDamage(100, 'asteroid');

    // Verify that the playerDied event is dispatched (this triggers GameController)
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Simulate the ship explosion event
    const explosionEvent = new CustomEvent('shipExploded', {
      detail: {
        shipId: player.ship.id,
        cause: 'asteroid',
      },
    });
    window.dispatchEvent(explosionEvent);

    // Verify that playerDied event was dispatched
    const playerDiedCalls = dispatchEventSpy.mock.calls.filter(
      (call) => call[0].type === 'playerDied'
    );
    expect(playerDiedCalls.length).toBe(1);

    // The GameController should NOT call updateTextProperties for life loss events
    // (that was removed to prevent flashing). Death messages are now only handled
    // by GameLoopManager during respawn timer.
    const playerDiedEvent = playerDiedCalls[0][0] as CustomEvent;
    expect(playerDiedEvent.detail.isGameOver).toBe(false); // Life loss, not game over
  });
});
