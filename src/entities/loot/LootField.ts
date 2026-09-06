import type { LootData } from '../../../shared-types';

/** Client snapshot of server-authoritative kill loot. */
export class LootField {
  private static instance: LootField;
  private loot: LootData[] = [];

  static getInstance(): LootField {
    if (!LootField.instance) {
      LootField.instance = new LootField();
    }
    return LootField.instance;
  }

  applySnapshot(loot: LootData[]): void {
    this.loot = loot.map((drop) => ({
      id: drop.id,
      position: { x: drop.position.x, y: drop.position.y },
      mass: drop.mass,
      radius: drop.radius,
    }));
  }

  getAll(): LootData[] {
    return this.loot;
  }

  clear(): void {
    this.loot = [];
  }
}
