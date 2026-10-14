import { GAME } from '../../shared/constants/gameplay';
import type { MapAsset, Position } from '../../shared-types';

export const REMAINS_LIMIT = 128;
export const REMAINS_LIFETIME_FRAMES = 10 * 60 * GAME.FPS;

type Remain = { asset: MapAsset; expiresAt: number };

/** Decorative session history. Bounded independently of explored world size; never saved to disk. */
export class WorldRemains {
  private sequence = 0;
  private readonly entries: Remain[] = [];

  add(kind: 'ship-remains' | 'nest-remains', position: Position, frame: number): void {
    this.entries.push({
      asset: {
        id: `remains:${++this.sequence}`,
        kind,
        position: { ...position },
        name: kind === 'ship-remains' ? 'Pilot wreck' : 'Nest ruins',
      },
      expiresAt: frame + REMAINS_LIFETIME_FRAMES,
    });
    if (this.entries.length > REMAINS_LIMIT) {
      this.entries.shift();
    }
  }

  snapshot(frame: number): MapAsset[] {
    while (this.entries[0] && this.entries[0].expiresAt <= frame) {
      this.entries.shift();
    }
    return this.entries.map(({ asset }) => ({ ...asset, position: { ...asset.position } }));
  }

  clear(): void {
    this.entries.length = 0;
  }
}
