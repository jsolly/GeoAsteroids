import { parseDebugReportReceipt, parseDebugReportSubmission } from '../../shared/debugReports';
import type {
  DebugDiagnosticSnapshot,
  DebugReportReceipt,
  DebugReportSubmission,
} from '../../shared-types';
import {
  createDebugReportStorage,
  type DebugReportStorage,
  type StoredDebugReport,
} from './debugReportStorage';

export interface DebugReportClientView {
  state: 'idle' | 'sending' | 'pending' | 'delivered' | 'blocked' | 'error';
  message: string;
  submission: DebugReportSubmission | null;
  reportId: string | null;
  canSend: boolean;
}

function debugReportOrigin(): string {
  const configured = import.meta.env.VITE_WEBSOCKET_URL;
  if (!configured) {
    return location.origin;
  }
  const url = new URL(configured);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  return url.origin;
}

function receiptFrom(value: unknown, expectedId: string): DebugReportReceipt {
  const receipt = parseDebugReportReceipt(value);
  if (receipt.id !== expectedId) {
    throw new Error('Unexpected server response. Retry this same report.');
  }
  return receipt;
}

export function createDebugReportClient(
  changed: (view: DebugReportClientView) => void,
  options: { storage?: DebugReportStorage; fetch?: typeof fetch; origin?: string } = {}
) {
  const storage = options.storage ?? createDebugReportStorage();
  const request = options.fetch ?? fetch;
  let record: StoredDebugReport | null = null;
  let ready = false;
  let disposed = false;
  let busy = false;
  let controller: AbortController | null = null;
  let poll: ReturnType<typeof setTimeout> | undefined;
  let polls = 0;
  let view: DebugReportClientView = {
    state: 'idle',
    message: 'Checking saved reports…',
    submission: null,
    reportId: null,
    canSend: false,
  };
  const origin = () => options.origin ?? debugReportOrigin();
  function publish(state: DebugReportClientView['state'], message: string) {
    if (disposed) {
      return;
    }
    view = {
      state,
      message,
      submission: record?.kind === 'submission' ? record.submission : null,
      reportId: record?.kind === 'receipt' ? record.receipt.id : (record?.submission.id ?? null),
      canSend: ready && !busy && record === null,
    };
    changed(view);
  }
  function schedule() {
    clearTimeout(poll);
    if (
      !disposed &&
      polls++ < 30 &&
      record?.kind === 'receipt' &&
      record.receipt.state !== 'delivered'
    ) {
      poll = setTimeout(() => {
        void retry();
      }, 10_000);
    }
  }
  async function transmit() {
    if (disposed || busy || record === null) {
      return;
    }
    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10_000);
    publish('sending', 'Sending…');
    let accepted = false;
    try {
      const active = record;
      const id = active.kind === 'submission' ? active.submission.id : active.receipt.id;
      const token =
        active.kind === 'submission' ? active.submission.receiptToken : active.receiptToken;
      const response = await request(
        `${origin()}/debug-reports${active.kind === 'receipt' ? `/${id}` : ''}`,
        {
          method: active.kind === 'submission' ? 'POST' : 'GET',
          headers:
            active.kind === 'submission'
              ? { 'Content-Type': 'application/json' }
              : { Authorization: `Bearer ${token}` },
          ...(active.kind === 'submission' ? { body: JSON.stringify(active.submission) } : {}),
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        throw new Error(
          `Server did not accept this request (HTTP ${response.status}). Retry or download the report.`
        );
      }
      const receipt = receiptFrom(await response.json(), id);
      accepted = true;
      const next: StoredDebugReport = { kind: 'receipt', receipt, receiptToken: token };
      await storage.write(next);
      record = next;
      busy = false;
      publish(
        receipt.state,
        receipt.state === 'delivered'
          ? 'Delivered'
          : receipt.state === 'blocked'
            ? 'Saved, delivery blocked'
            : 'Saved, pending delivery'
      );
      schedule();
    } catch (error) {
      busy = false;
      publish(
        record?.kind === 'receipt' ? record.receipt.state : 'error',
        record?.kind === 'receipt'
          ? 'Saved. Delivery status unavailable; retry to check.'
          : accepted
            ? 'Server save confirmed. Local receipt could not be saved; retry the same report.'
            : `Not confirmed saved. ${error instanceof Error ? error.message : 'Retry this same report.'}`
      );
    } finally {
      clearTimeout(timeout);
      controller = null;
    }
  }
  async function retry() {
    await transmit();
  }
  return {
    async restore() {
      try {
        record = await storage.read();
        if (disposed) {
          return;
        }
        ready = true;
        if (record) {
          await transmit();
        } else {
          publish('idle', 'Describe what happened.');
        }
      } catch (error) {
        publish(
          'error',
          error instanceof Error ? error.message : 'Browser storage is unavailable.'
        );
      }
    },
    async send(description: string, diagnostics: DebugDiagnosticSnapshot) {
      if (!view.canSend || busy || disposed) {
        return;
      }
      busy = true;
      try {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const submission = parseDebugReportSubmission({
          version: 1,
          id: crypto.randomUUID(),
          receiptToken: [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''),
          description: description.trim(),
          submittedAt: new Date().toISOString(),
          diagnostics,
        });
        record = { kind: 'submission', submission };
        publish('sending', 'Saving in this browser…');
        await storage.write(record);
        busy = false;
        polls = 0;
        await transmit();
      } catch (error) {
        busy = false;
        publish(
          'error',
          `Not saved. ${error instanceof Error ? error.message : 'Copy or download this report.'}`
        );
      }
    },
    async newReport() {
      if (busy || disposed || record?.kind !== 'receipt') {
        return false;
      }
      busy = true;
      clearTimeout(poll);
      try {
        await storage.write(null);
        record = null;
        busy = false;
        publish('idle', 'Describe what happened.');
        return true;
      } catch {
        busy = false;
        publish(
          record?.kind === 'receipt' ? record.receipt.state : 'error',
          'Saved. Browser storage could not start a new report; retry.'
        );
        return false;
      }
    },
    async retry() {
      if (record?.kind === 'submission') {
        try {
          await storage.write(record);
        } catch {
          publish('error', 'Not saved. Browser storage failed; copy or download this report.');
          return;
        }
      }
      polls = 0;
      await retry();
    },
    dispose() {
      disposed = true;
      clearTimeout(poll);
      controller?.abort();
    },
  };
}
