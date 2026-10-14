import type { CivicModule, Position } from '../shared-types';
import { frontierSite } from './frontier';
import { civicLot, civicLotAt, civicModuleName, FURNACES, TOWN_HEARTH } from './furnaces';

export const FURNACE_BUILD = {
  RADIUS: TOWN_HEARTH.radius,
  ISSUE: {
    STAND: 'Stand inside a furnace foundation',
    LIT: 'This furnace is already burning',
    READY: 'Furnace builder not ready',
  },
} as const;

/**
 * The one "on a dark furnace footprint" test: the ship's center is inside an
 * unlit lot. Scout Build, the Hauler hint, and the server build check agree.
 */
export function onDarkFurnaceFootprint(
  position: Position,
  isLit: (lotId: string) => boolean
): boolean {
  const lot = civicLotAt(position);
  return Boolean(lot && !isLit(lot.id));
}

const CELL_SIZE = 1_000;

interface Hearth {
  id: string;
  name: string;
  position: Position;
  radius: number;
}

interface HearthBranch {
  hearth: Hearth;
  axis: 'x' | 'y';
  left: HearthBranch | null;
  right: HearthBranch | null;
}
function hearthTree(sites: Hearth[], depth = 0): HearthBranch | null {
  if (sites.length === 0) {
    return null;
  }
  const axis = depth % 2 === 0 ? 'x' : 'y';
  sites.sort((a, b) => a.position[axis] - b.position[axis] || a.id.localeCompare(b.id));
  const middle = Math.floor(sites.length / 2),
    hearth = sites[middle];
  if (!hearth) {
    return null;
  }
  return {
    hearth,
    axis,
    left: hearthTree(sites.slice(0, middle), depth + 1),
    right: hearthTree(sites.slice(middle + 1), depth + 1),
  };
}

/** Lit hearths only. Dark furnace lots stay out of intake, guidance, and spider safety. */
export class FurnaceField {
  private modules: CivicModule[] = [];
  private frontier: Hearth[] = [];
  private readonly frontierIds = new Set<string>();
  private tree: HearthBranch | null = null;
  private readonly lit = new Set<string>();
  private readonly labels = new Map<string, string>();
  private readonly cells = new Map<string, Hearth[]>();

  constructor() {
    this.reindex();
  }

  replaceFrontier(ids: readonly string[]): void {
    const next = ids.flatMap((id) => {
      const site = frontierSite(id);
      return site ? [site] : [];
    });
    if (
      next.length === this.frontier.length &&
      next.every((site, i) => site.id === this.frontier[i]?.id)
    ) {
      return;
    }
    this.frontier = next;
    this.frontierIds.clear();
    for (const site of next) {
      this.frontierIds.add(site.id);
    }
    this.reindex();
  }

  frontierHearths(): readonly Hearth[] {
    return this.frontier;
  }

  litModules(): readonly CivicModule[] {
    return this.modules;
  }

  /** Name shown for a lit module, or the plan name while the lot is still dark. */
  displayName(id: string): string {
    return (
      this.labels.get(id) ??
      frontierSite(id)?.name ??
      civicLot(id)?.name ??
      (id === TOWN_HEARTH.id ? TOWN_HEARTH.name : '')
    );
  }

  isLit(id: string): boolean {
    return id === TOWN_HEARTH.id || this.lit.has(id) || this.frontierIds.has(id);
  }

  replaceLit(modules: readonly CivicModule[]): void {
    if (
      modules.length === this.modules.length &&
      modules.every(
        (module, index) =>
          module.id === this.modules[index]?.id &&
          module.builderName === this.modules[index]?.builderName &&
          module.builderId === this.modules[index]?.builderId
      )
    ) {
      return;
    }
    this.modules = modules.map((module) => ({
      id: module.id,
      builderName: module.builderName,
      ...(module.builderId ? { builderId: module.builderId } : {}),
    }));
    this.lit.clear();
    for (const module of this.modules) {
      this.lit.add(module.id);
    }
    this.reindex();
  }

  light(id: string, builderName = '', builderId = ''): void {
    if (this.lit.has(id) || !civicLot(id)) {
      return;
    }
    this.modules = [
      ...this.modules,
      builderId ? { id, builderName, builderId } : { id, builderName },
    ];
    this.lit.add(id);
    this.reindex();
  }

  private reindex(): void {
    this.cells.clear();
    this.labels.clear();
    for (const site of this.frontier) {
      this.index(site);
    }
    for (const site of FURNACES) {
      this.index(site);
    }
    for (const module of this.modules) {
      const lot = civicLot(module.id);
      if (!lot) {
        continue;
      }
      const name = civicModuleName(module.builderName, lot.name);
      this.labels.set(lot.id, name);
      this.index({ id: lot.id, name, position: lot.position, radius: lot.radius });
    }
    this.tree = hearthTree([...this.cells.values()].flat());
  }

  private index(site: Hearth): void {
    const key = `${Math.floor(site.position.x / CELL_SIZE)},${Math.floor(site.position.y / CELL_SIZE)}`;
    const cell = this.cells.get(key) ?? [];
    cell.push(site);
    this.cells.set(key, cell);
  }

  nearby(position: Position, radius: number): Hearth[] {
    const found: Hearth[] = [];
    for (
      let x = Math.floor((position.x - radius) / CELL_SIZE);
      x <= Math.floor((position.x + radius) / CELL_SIZE);
      x++
    ) {
      for (
        let y = Math.floor((position.y - radius) / CELL_SIZE);
        y <= Math.floor((position.y + radius) / CELL_SIZE);
        y++
      ) {
        for (const site of this.cells.get(`${x},${y}`) ?? []) {
          if (Math.hypot(position.x - site.position.x, position.y - site.position.y) <= radius) {
            found.push(site);
          }
        }
      }
    }
    return found;
  }

  /** Hull contact can reach the intake rim; point deliveries use the grate itself. */
  intakeAt(position: Position, hullRadius = 0): Hearth | undefined {
    return this.nearby(position, TOWN_HEARTH.radius + hullRadius).find(
      (site) =>
        Math.hypot(position.x - site.position.x, position.y - site.position.y) <=
        site.radius + hullRadius
    );
  }

  nearest(position: Position): Hearth {
    let nearest: Hearth = TOWN_HEARTH;
    let distance = Math.hypot(position.x - nearest.position.x, position.y - nearest.position.y);
    const visit = (branch: HearthBranch | null): void => {
      if (!branch) {
        return;
      }
      const site = branch.hearth;
      const candidate = Math.hypot(position.x - site.position.x, position.y - site.position.y);
      if (
        candidate < distance ||
        (candidate === distance && site.id.localeCompare(nearest.id) < 0)
      ) {
        nearest = site;
        distance = candidate;
      }
      const delta = position[branch.axis] - site.position[branch.axis];
      visit(delta < 0 ? branch.left : branch.right);
      if (Math.abs(delta) <= distance) {
        visit(delta < 0 ? branch.right : branch.left);
      }
    };
    visit(this.tree);
    return nearest;
  }
}
