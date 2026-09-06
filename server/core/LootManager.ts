import type { LootData, Position } from '../../shared-types';
import { GROWTH, canCollectLoot, lootOverlap, planKillLoot } from '../../shared/shipGrowth';
import type { GameEntity } from './EntityManager';
import type { RNGService } from './RNGService';

interface TrackedLoot extends LootData {
  expiresAt: number;
}

export class LootManager {
  private loot = new Map<string, TrackedLoot>();
  private nextId = 1;
  private rng: RNGService;

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  public spawnFromKill(entity: GameEntity, gameTime: number): LootData[] {
    const { pelletMasses } = planKillLoot(entity.mass ?? GROWTH.BASE_MASS);
    const spawned: LootData[] = [];

    for (const pelletMass of pelletMasses) {
      const drop = this.createPellet(entity.position, pelletMass, gameTime);
      this.loot.set(drop.id, drop);
      spawned.push(this.toPublic(drop));
    }

    this.enforceCap();
    return spawned;
  }

  public collectOverlaps(entities: GameEntity[]): Array<{ collector: GameEntity; loot: LootData }> {
    const collected: Array<{ collector: GameEntity; loot: LootData }> = [];
    const collectors = entities
      .filter((entity) => canCollectLoot(entity))
      .sort((a, b) => a.id.localeCompare(b.id));

    const drops = [...this.loot.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const drop of drops) {
      const winner = collectors.find((entity) =>
        lootOverlap(entity.position, entity.mass ?? GROWTH.BASE_MASS, drop.position, drop.radius)
      );
      if (!winner) {
        continue;
      }
      this.loot.delete(drop.id);
      collected.push({ collector: winner, loot: this.toPublic(drop) });
    }

    return collected;
  }

  public expire(gameTime: number): void {
    for (const [id, drop] of this.loot) {
      if (gameTime >= drop.expiresAt) {
        this.loot.delete(id);
      }
    }
  }

  public getAll(): LootData[] {
    return [...this.loot.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((drop) => this.toPublic(drop));
  }

  public getCount(): number {
    return this.loot.size;
  }

  public clear(): void {
    this.loot.clear();
  }

  private createPellet(origin: Position, mass: number, gameTime: number): TrackedLoot {
    const angle = this.rng.random() * Math.PI * 2;
    const dist =
      GROWTH.SCATTER_MIN + this.rng.random() * (GROWTH.SCATTER_MAX - GROWTH.SCATTER_MIN);
    return {
      id: `loot-${this.nextId++}`,
      position: {
        x: origin.x + Math.cos(angle) * dist,
        y: origin.y + Math.sin(angle) * dist,
      },
      mass,
      radius: GROWTH.LOOT_RADIUS,
      expiresAt: gameTime + GROWTH.LOOT_TTL_FRAMES,
    };
  }

  private enforceCap(): void {
    if (this.loot.size <= GROWTH.MAX_LOOT) {
      return;
    }
    const oldest = [...this.loot.values()].sort((a, b) => a.id.localeCompare(b.id));
    const overflow = this.loot.size - GROWTH.MAX_LOOT;
    for (let i = 0; i < overflow; i++) {
      const drop = oldest[i];
      if (drop) {
        this.loot.delete(drop.id);
      }
    }
  }

  private toPublic(drop: TrackedLoot): LootData {
    return {
      id: drop.id,
      position: { x: drop.position.x, y: drop.position.y },
      mass: drop.mass,
      radius: drop.radius,
    };
  }
}
