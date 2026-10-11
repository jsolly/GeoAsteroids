/* @vitest-environment node */
import { once } from 'node:events';
import { afterEach, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createServerInstance } from '../../../server/createServer';
import { ClientLogger } from '../../../server/services/ClientLogger';
import { logger } from '../../../setup/serverLogger';
import { createLogRecord, stringifyLogRecord } from '../../../shared/logRecords';
import { SNAPSHOT_VERSION } from '../../../shared/snapshotProtocol';

let server: ReturnType<typeof createServerInstance> | undefined;
const sockets: WebSocket[] = [];

async function connect(path: string): Promise<WebSocket> {
  if (!server) {
    throw new Error('Test server is not running');
  }
  const url = new URL(`ws://127.0.0.1:${await server.listening}${path}`);
  if (url.pathname === '/ws') {
    url.searchParams.set('snapshotVersion', String(SNAPSHOT_VERSION));
    url.searchParams.set('asteroidInteractions', '1');
  }
  const socket = new WebSocket(url);
  socket.on('error', () => undefined);
  sockets.push(socket);
  await once(socket, 'open');
  return socket;
}

function sendOneChunk(socket: WebSocket, frames: readonly string[]): void {
  const transport = (socket as unknown as { _socket: { cork(): void; uncork(): void } })._socket;
  transport.cork();
  try {
    for (const frame of frames) {
      socket.send(frame);
    }
  } finally {
    transport.uncork();
  }
}

async function drainDeferredFrames(): Promise<void> {
  for (let step = 0; step < 16; step += 1) {
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    if (socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
  }
  await server?.close();
  server = undefined;
});

test('public WebSockets reject inbound frames larger than 64 KiB', async () => {
  server = createServerInstance({ port: 0, nodeEnv: 'test' });
  const logs = await connect('/logs');
  const closed = once(logs, 'close');

  logs.send(
    JSON.stringify({
      type: 'clientLog',
      data: { level: 'error', line: 'x'.repeat(70 * 1024) },
    })
  );

  const [code] = await closed;
  expect(code).toBe(1009);
});

function structuredLogFrame(): string {
  return JSON.stringify({
    type: 'clientLog',
    data: {
      level: 'info',
      sessionId: 'wire-session',
      line: stringifyLogRecord(
        createLogRecord({
          timestamp: new Date().toISOString(),
          source: 'client',
          level: 'info',
          releaseId: 'test',
          message: 'bounded forwarding remains active',
        })
      ),
    },
  });
}

test('/logs accepts structured records through the real ingress', async () => {
  server = createServerInstance({ port: 0, nodeEnv: 'test' });
  const before = ClientLogger.getDiagnostics();
  const valid = await connect('/logs');
  valid.send(structuredLogFrame());
  const pong = once(valid, 'pong');
  valid.ping();
  await pong;
  expect(valid.readyState).toBe(WebSocket.OPEN);
  expect(ClientLogger.getDiagnostics().accepted).toBe(before.accepted + 1);
  expect(await ClientLogger.flushPending()).toBe(true);
});

test('the gameplay socket rejects log telemetry because /logs is the only log ingress', async () => {
  server = createServerInstance({ port: 0, nodeEnv: 'test' });
  const before = ClientLogger.getDiagnostics();
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  try {
    const gameplay = await connect('/ws');
    const received: unknown[] = [];
    gameplay.on('message', (raw) => received.push(JSON.parse(String(raw))));
    gameplay.send(structuredLogFrame());
    // The server handles the text frame before answering the following ping.
    const pong = once(gameplay, 'pong');
    gameplay.ping();
    await pong;
    expect(received).toContainEqual(
      expect.objectContaining({ type: 'error', data: 'Unknown message type: clientLog' })
    );
    expect(gameplay.readyState).toBe(WebSocket.OPEN);
    expect(ClientLogger.getDiagnostics().accepted).toBe(before.accepted);
  } finally {
    warn.mockRestore();
  }
});

test('the log route closes retired plaintext and invalid record schemas', async () => {
  server = createServerInstance({ port: 0, nodeEnv: 'test' });
  for (const data of [
    { level: 'info', message: 'retired plaintext' },
    { level: 'info', line: '{broken', sessionId: 'wire-session' },
    { level: 'TRACE', line: 'not allowed', sessionId: 'wire-session' },
  ]) {
    const invalid = await connect('/logs');
    const closed = once(invalid, 'close');
    invalid.send(JSON.stringify({ type: 'clientLog', data }));
    const [code] = await closed;
    expect(code).toBe(1006);
  }
});

test('a bad log frame ends the socket so a following frame is not parsed', async () => {
  server = createServerInstance({ port: 0, nodeEnv: 'test' });
  const before = ClientLogger.getDiagnostics();
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  try {
    for (const frame of [
      '{broken',
      JSON.stringify({ type: 'unexpected', data: { message: 'discard this' } }),
    ]) {
      const socket = await connect('/logs');
      const closed = once(socket, 'close');
      sendOneChunk(socket, [frame, frame]);
      expect((await closed)[0]).toBe(1006);
      await drainDeferredFrames();
      expect(socket.readyState).toBe(WebSocket.CLOSED);
    }
    const after = ClientLogger.getDiagnostics();
    expect(after.invalid).toBe(before.invalid + 2);
    expect(after.accepted).toBe(before.accepted);
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
  }
});
