import { WebSocket } from 'ws';

const WIRE_TIMEOUT_MS = 2_000;
type WirePayload = Record<string, unknown>;
export type WireMessage = { type: string; data?: unknown };

function isRecord(value: unknown): value is WirePayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asWireError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Invalid server message', { cause: value });
}
function decodeMessage(text: string): WireMessage {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || typeof parsed['type'] !== 'string') {
    throw new Error('Server message must be an object with a string type');
  }
  return {
    type: parsed['type'],
    ...(Object.hasOwn(parsed, 'data') ? { data: parsed['data'] } : {}),
  };
}

export class WireClient {
  readonly messages: WireMessage[] = [];
  readonly wireMessages: Array<{ readonly raw: string; readonly message: WireMessage }> = [];
  readonly failures: Error[] = [];
  private readonly pending = new Set<() => void>();
  private recheckQueued = false;
  private pongs = 0;

  constructor(readonly ws: WebSocket) {
    ws.on('error', (error) => {
      this.failures.push(asWireError(error));
      this.recheck();
    });
    ws.on('message', (raw) => {
      try {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        const message = decodeMessage(text);
        this.messages.push(message);
        this.wireMessages.push({ raw: text, message });
      } catch (error) {
        this.failures.push(asWireError(error));
      }
      this.recheck();
    });
    ws.on('open', () => this.recheck());
    ws.on('close', () => this.recheck());
    ws.on('pong', () => {
      this.pongs++;
      this.recheck();
    });
  }

  private recheck(): void {
    if (this.recheckQueued) {
      return;
    }
    this.recheckQueued = true;
    // Snapshot decoder listeners registered by consumers run before predicates.
    queueMicrotask(() => {
      this.recheckQueued = false;
      for (const check of this.pending) {
        check();
      }
    });
  }

  waitFor<T>(read: () => T | undefined, label: string, timeout = WIRE_TIMEOUT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.pending.delete(check);
      };
      const fail = (error: unknown) => {
        cleanup();
        reject(error);
      };
      const check = () => {
        try {
          this.assertHealthy();
          const value = read();
          if (value !== undefined) {
            cleanup();
            resolve(value);
          } else if (this.ws.readyState === WebSocket.CLOSED) {
            fail(new Error(`Socket closed before ${label}`));
          }
        } catch (error) {
          fail(error);
        }
      };
      const timer = setTimeout(() => fail(new Error(`Timed out: ${label}`)), timeout);
      this.pending.add(check);
      check();
    });
  }

  async open(): Promise<void> {
    await this.waitFor(
      () => (this.ws.readyState === WebSocket.OPEN ? true : undefined),
      'socket open'
    );
  }
  send(message: WirePayload): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot send on a closed gameplay socket');
    }
    this.ws.send(JSON.stringify(message));
  }
  async barrier(): Promise<void> {
    this.assertHealthy();
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot ping a closed gameplay socket');
    }
    const before = this.pongs;
    const pong = this.waitFor(() => (this.pongs > before ? true : undefined), 'socket pong');
    try {
      this.ws.ping((error?: Error) => {
        if (error) {
          this.failures.push(error);
          this.recheck();
        }
      });
    } catch (error) {
      this.failures.push(asWireError(error));
      this.recheck();
    }
    await pong;
  }
  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) {
      return;
    }
    // Errors stay recorded while close is observed; even failed clients must close.
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.ws.off('close', closed);
      };
      const closed = () => {
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out: socket close'));
      }, WIRE_TIMEOUT_MS);
      this.ws.once('close', closed);
      try {
        this.ws.close();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
  mark(): number {
    return this.messages.length;
  }
  resetMessages(): void {
    this.messages.length = 0;
    this.wireMessages.length = 0;
  }
  assertHealthy(): void {
    const failure = this.failures[0];
    if (failure) {
      throw failure;
    }
  }
}
