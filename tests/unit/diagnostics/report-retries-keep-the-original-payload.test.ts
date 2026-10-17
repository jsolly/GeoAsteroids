import { afterEach, expect, test, vi } from 'vitest';
import type { DebugDiagnosticSnapshot } from '../../../shared-types';
import {
  createDebugReportClient,
  type DebugReportClientView,
} from '../../../src/diagnostics/debugReportClient';
import type {
  DebugReportStorage,
  StoredDebugReport,
} from '../../../src/diagnostics/debugReportStorage';

const snapshot: DebugDiagnosticSnapshot = {
  state: { version: 1, capturedAt: '2026-10-15T12:00:00.000Z', sessionId: 'test-session' },
  recentLogs: [],
};
function memoryStorage() {
  let saved: StoredDebugReport | null = null;
  const storage: DebugReportStorage = {
    read() {
      return Promise.resolve(structuredClone(saved));
    },
    write(value) {
      saved = structuredClone(value);
      return Promise.resolve();
    },
  };
  return storage;
}
afterEach(() => {
  vi.useRealTimers();
});

test('a lost acceptance followed by reload resends exactly the persisted submission', async () => {
  const storage = memoryStorage();
  const bodies: string[] = [];
  const lost = vi.fn<typeof fetch>((_url, init) => {
    bodies.push(String(init?.body));
    return Promise.reject(new Error('acknowledgment lost'));
  });
  const first = createDebugReportClient(() => {}, {
    storage,
    fetch: lost,
    origin: 'https://game.example',
  });
  await first.restore();
  await first.send('Thruster stopped', snapshot);
  first.dispose();
  const delivery = vi.fn<typeof fetch>((_url, init) => {
    bodies.push(String(init?.body));
    const report: unknown = JSON.parse(String(init?.body));
    if (typeof report !== 'object' || report === null || !('id' in report)) {
      throw new Error('missing report');
    }
    return Promise.resolve(
      new Response(JSON.stringify({ id: report['id'], state: 'pending' }), { status: 202 })
    );
  });
  const views: DebugReportClientView[] = [];
  const restored = createDebugReportClient((view) => views.push(view), {
    storage,
    fetch: delivery,
    origin: 'https://game.example',
  });
  await restored.restore();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
  expect(views.at(-1)?.message).toBe('Saved, pending delivery');
  expect(await storage.read()).toMatchObject({ kind: 'receipt', receipt: { state: 'pending' } });
  expect(JSON.stringify(await storage.read())).not.toContain('Thruster stopped');
  restored.dispose();
});

test('failed browser persistence never sends and retains the immutable report for recovery', async () => {
  const request = vi.fn<typeof fetch>();
  const views: DebugReportClientView[] = [];
  const storage: DebugReportStorage = {
    read() {
      return Promise.resolve(null);
    },
    write() {
      return Promise.reject(new Error('quota'));
    },
  };
  const client = createDebugReportClient((view) => views.push(view), { storage, fetch: request });
  await client.restore();
  await client.send('Please inspect this', snapshot);
  expect(request).not.toHaveBeenCalled();
  expect(views.at(-1)).toMatchObject({
    state: 'error',
    submission: { description: 'Please inspect this' },
    canSend: false,
  });
  await client.retry();
  expect(request).not.toHaveBeenCalled();
  client.dispose();
});

test('receipt checks use capability authorization and independent HTTP transport', async () => {
  const storage = memoryStorage();
  await storage.write({
    kind: 'receipt',
    receipt: { id: '00000000-0000-4000-8000-000000000001', state: 'pending' },
    receiptToken: 'a'.repeat(64),
  });
  const request = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', state: 'delivered' })
      )
    )
  );
  const views: DebugReportClientView[] = [];
  const client = createDebugReportClient((view) => views.push(view), {
    storage,
    fetch: request,
    origin: 'https://game.example',
  });
  await client.restore();
  expect(request).toHaveBeenCalledWith(
    'https://game.example/debug-reports/00000000-0000-4000-8000-000000000001',
    expect.objectContaining({
      method: 'GET',
      headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
    })
  );
  expect(views.at(-1)?.state).toBe('delivered');
  client.dispose();
});

test('a durably accepted pending report permits an explicit new report with a new identity', async () => {
  const storage = memoryStorage();
  const ids: string[] = [];
  const request = vi.fn<typeof fetch>((_url, init) => {
    const input: unknown = JSON.parse(String(init?.body));
    if (
      typeof input !== 'object' ||
      input === null ||
      !('id' in input) ||
      typeof input['id'] !== 'string'
    ) {
      throw new Error('missing report');
    }
    ids.push(input['id']);
    return Promise.resolve(
      new Response(JSON.stringify({ id: input['id'], state: 'pending' }), { status: 202 })
    );
  });
  const client = createDebugReportClient(() => {}, {
    storage,
    fetch: request,
    origin: 'https://game.example',
  });
  await client.restore();
  await client.send('First incident', snapshot);
  await client.newReport();
  expect(await storage.read()).toBeNull();
  await client.send('Second incident', snapshot);
  expect(ids).toHaveLength(2);
  expect(ids[1]).not.toBe(ids[0]);
  client.dispose();
});

test('a confirmed server save with a failed local receipt write preserves the original retry identity', async () => {
  const base = memoryStorage();
  let rejectReceipt = true;
  const storage: DebugReportStorage = {
    read: base.read,
    async write(value) {
      if (rejectReceipt && value?.kind === 'receipt') {
        throw new Error('local disk full');
      }
      await base.write(value);
    },
  };
  const bodies: string[] = [];
  const request = vi.fn<typeof fetch>((_url, init) => {
    bodies.push(String(init?.body));
    const input: unknown = JSON.parse(String(init?.body));
    if (typeof input !== 'object' || input === null || !('id' in input)) {
      throw new Error('missing report');
    }
    return Promise.resolve(
      new Response(JSON.stringify({ id: input['id'], state: 'pending' }), { status: 202 })
    );
  });
  const views: DebugReportClientView[] = [];
  const client = createDebugReportClient((view) => views.push(view), {
    storage,
    fetch: request,
    origin: 'https://game.example',
  });
  await client.restore();
  await client.send('Connection froze', snapshot);
  expect(views.at(-1)?.message).toContain('Server save confirmed');
  expect(await storage.read()).toMatchObject({ kind: 'submission' });
  rejectReceipt = false;
  await client.retry();
  expect(bodies[1]).toBe(bodies[0]);
  expect(await storage.read()).toMatchObject({ kind: 'receipt' });
  client.dispose();
});

test('a delivered receipt requires explicit New report before another submission', async () => {
  const storage = memoryStorage();
  await storage.write({
    kind: 'receipt',
    receipt: { id: '00000000-0000-4000-8000-000000000001', state: 'delivered' },
    receiptToken: 'a'.repeat(64),
  });
  const request = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', state: 'delivered' })
      )
    )
  );
  const views: DebugReportClientView[] = [];
  const client = createDebugReportClient((view) => views.push(view), {
    storage,
    fetch: request,
    origin: 'https://game.example',
  });
  await client.restore();
  expect(views.at(-1)).toMatchObject({ state: 'delivered', canSend: false });
  await client.send('Old incident repeated', snapshot);
  expect(request).toHaveBeenCalledTimes(1);
  expect(await client.newReport()).toBe(true);
  expect(views.at(-1)?.canSend).toBe(true);
  client.dispose();
});
