import { parseDebugReportSubmission } from '../../shared/debugReports';
import type { DebugReportReceipt, DebugReportSubmission } from '../../shared-types';

export type StoredDebugReport =
  | { kind: 'submission'; submission: DebugReportSubmission }
  | { kind: 'receipt'; receipt: DebugReportReceipt; receiptToken: string };

export interface DebugReportStorage {
  read(): Promise<StoredDebugReport | null>;
  write(value: StoredDebugReport | null): Promise<void>;
}

function parseStoredReport(value: unknown): StoredDebugReport | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    throw new Error('Stored report is unreadable. Browser storage was not changed.');
  }
  if (value['kind'] === 'submission' && 'submission' in value) {
    return { kind: 'submission', submission: parseDebugReportSubmission(value['submission']) };
  }
  if (
    value['kind'] === 'receipt' &&
    'receiptToken' in value &&
    typeof value['receiptToken'] === 'string' &&
    'receipt' in value
  ) {
    const receipt = value['receipt'];
    if (
      typeof receipt === 'object' &&
      receipt !== null &&
      'id' in receipt &&
      typeof receipt['id'] === 'string' &&
      'state' in receipt &&
      (receipt['state'] === 'pending' ||
        receipt['state'] === 'blocked' ||
        receipt['state'] === 'delivered')
    ) {
      return {
        kind: 'receipt',
        receipt: { id: receipt['id'], state: receipt['state'] },
        receiptToken: value['receiptToken'],
      };
    }
  }
  throw new Error('Stored report is unreadable. Browser storage was not changed.');
}

/** Resolve writes on transaction completion: request success alone is not durable. */
export function createDebugReportStorage(): DebugReportStorage {
  async function transaction(
    mode: IDBTransactionMode,
    value?: StoredDebugReport | null
  ): Promise<unknown> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      const request = indexedDB.open('georoids-debug-reports', 1);
      const deadline = setTimeout(() => {
        settled = true;
        reject(new Error('Browser storage timed out. Copy or download this report.'));
      }, 10_000);
      request.onupgradeneeded = () => {
        if (settled) {
          request.transaction?.abort();
        } else {
          request.result.createObjectStore('reports');
        }
      };
      request.onerror = () => {
        clearTimeout(deadline);
        settled = true;
        reject(new Error('Browser storage unavailable. Copy or download this report.'));
      };
      request.onblocked = () => {
        clearTimeout(deadline);
        settled = true;
        reject(new Error('Browser storage blocked. Close older GeoRoids tabs and retry.'));
      };
      request.onsuccess = () => {
        clearTimeout(deadline);
        if (settled) {
          request.result.close();
        } else {
          settled = true;
          resolve(request.result);
        }
      };
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction('reports', mode);
        const store = tx.objectStore('reports');
        if (mode === 'readonly') {
          const all = store.getAll();
          const selected = store.get('current');
          tx.oncomplete = () => resolve({ records: all.result, selected: selected.result });
        } else {
          if (value) {
            const id = value.kind === 'submission' ? value.submission.id : value.receipt.id;
            store.put(value, id);
            store.put(id, 'current');
          } else {
            store.delete('current');
          }
          tx.oncomplete = () => resolve(undefined);
        }
        tx.onerror = tx.onabort = () =>
          reject(new Error('Browser storage failed. Copy or download this report.'));
      });
    } finally {
      database.close();
    }
  }
  return {
    async read() {
      const result = await transaction('readonly');
      if (
        typeof result !== 'object' ||
        result === null ||
        !('records' in result) ||
        !Array.isArray(result.records) ||
        !('selected' in result)
      ) {
        throw new Error('Browser report index is unreadable.');
      }
      const records = result.records
        .filter((value) => typeof value !== 'string')
        .map(parseStoredReport)
        .filter((value): value is StoredDebugReport => value !== null);
      // Retain each immutable submission under its own UUID. Two tabs can safely
      // retry the same oldest unsent report; neither can overwrite the other's payload.
      const unsent = records
        .filter((value) => value.kind === 'submission')
        .sort((left, right) => {
          if (left.kind !== 'submission' || right.kind !== 'submission') {
            return 0;
          }
          return left.submission.submittedAt.localeCompare(right.submission.submittedAt);
        });
      if (unsent[0]) {
        return unsent[0];
      }
      return (
        records.find((value) => value.kind === 'receipt' && value.receipt.id === result.selected) ??
        null
      );
    },
    async write(value) {
      await transaction('readwrite', value);
    },
  };
}
