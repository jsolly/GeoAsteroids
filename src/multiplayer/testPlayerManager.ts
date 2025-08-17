import { Ship } from '../entities/ship/Ship';
import { Vector } from '../physics/Vector';
import type { Player } from './types';

export class TestPlayerManager {
  private players: Map<string, Player> = new Map();

  public createTestPlayers(): void {
    // Test players are disabled by default
    // Only create if explicitly enabled for testing
    if (import.meta.env.VITE_ENABLE_TEST_PLAYERS !== 'true') {
      console.info('TEST_PLAYERS', 'Test players disabled by default');
      return;
    }

    console.info('TEST_PLAYERS', 'Creating test players for player count verification');

    // Clear any existing test players first
    this.clearTestPlayers();

    // Create 4 simple test players
    const positions = [
      new Vector(200, 200),
      new Vector(-200, -200),
      new Vector(300, -150),
      new Vector(-150, 300),
    ];

    const names = ['TestPlayer1', 'TestPlayer2', 'TestPlayer3', 'TestPlayer4'];
    const scores = [1500, 2300, 1800, 2100];

    for (let i = 0; i < 4; i++) {
      const testPlayer = this.createTestPlayer(
        `test-player-${i + 1}`,
        names[i],
        positions[i],
        scores[i]
      );
      this.players.set(testPlayer.id, testPlayer);
    }

    console.info('TEST_PLAYERS', 'Test players created successfully', {
      count: this.players.size,
      players: Array.from(this.players.values()).map((p) => ({ id: p.id, name: p.name })),
    });
  }

  public clearTestPlayers(): void {
    for (const [id] of this.players.entries()) {
      if (id.startsWith('test-')) {
        this.players.delete(id);
      }
    }
  }

  public getTestPlayers(): Map<string, Player> {
    return this.players;
  }

  private createTestPlayer(id: string, name: string, position: Vector, score: number): Player {
    const ship = new Ship(3, true, {
      position,
      rotation: Math.random() * Math.PI * 2,
    });

    const testPlayer: Player = {
      id,
      name,
      ship,
      score,
      lastUpdate: Date.now(),
      isBot: false,
      lives: 3,
      spawnProtectedUntil: Date.now() + 3000,
      respawn: () => {},
      onShipExploded: () => {},
    };

    return testPlayer;
  }
}
