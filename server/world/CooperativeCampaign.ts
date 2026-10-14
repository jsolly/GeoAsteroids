import type { CooperativeRecord, CooperativeWorld } from '../../shared-types';
import type { WorldCheckpoint } from './worldPersistence';

/** In-memory campaign owner. Checkpoints visit dirty identities, never saved-world history. */
export class CooperativeCampaign {
  private enabled: boolean;
  get activated(): boolean {
    return this.enabled;
  }
  private readonly records = new Map<string, CooperativeRecord>();
  private readonly dirty = new Set<string>();
  private readonly removed = new Set<string>();

  constructor(saved?: CooperativeWorld) {
    this.enabled = saved?.activated ?? false;
    for (const record of saved?.records ?? []) {
      this.records.set(`${record.kind}:${record.id}`, record);
    }
  }

  get<K extends CooperativeRecord['kind']>(
    kind: K,
    id: string
  ): Extract<CooperativeRecord, { kind: K }> | undefined {
    const row = this.records.get(`${kind}:${id}`);
    // The lookup key includes the discriminant; expose only the checked variant.
    if (row?.kind === kind) {
      return row as Extract<CooperativeRecord, { kind: K }>;
    }
    return undefined;
  }

  set(record: CooperativeRecord): void {
    if (!this.activated) {
      throw new Error('Cooperative campaign requires migration and activation');
    }
    const key = `${record.kind}:${record.id}`;
    this.records.set(key, record);
    this.dirty.add(key);
    this.removed.delete(key);
  }

  removeDowned(id: string): void {
    const key = `downed:${id}`;
    if (!this.records.delete(key)) {
      return;
    }
    this.dirty.delete(key);
    this.removed.add(key);
  }

  checkpoint(): WorldCheckpoint['cooperative'] {
    if (!this.activated || (this.dirty.size === 0 && this.removed.size === 0)) {
      return undefined;
    }
    return {
      records: [...this.dirty].flatMap((id) => {
        const row = this.records.get(id);
        return row ? [structuredClone(row)] : [];
      }),
      removed: [...this.removed],
    };
  }

  all(): readonly CooperativeRecord[] {
    return [...this.records.values()];
  }

  reset(): void {
    this.enabled = false;
    this.records.clear();
    this.dirty.clear();
    this.removed.clear();
  }

  saved(): void {
    this.dirty.clear();
    this.removed.clear();
  }
}
