// Client log forwarder: streams individual log messages to server via WebSocket
// Used by Logger.ts for structured logging

import { logger } from './Logger';
import { logsWebSocketUrlFromGameplay } from './logsWebSocketUrl';
import { getStoredItem, setStoredItem } from './safeStorage';

type ClientLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let sessionId: string | null = null;
let ws: WebSocket | null = null;
let messageQueue: string[] = [];
let reconnectTimer: number | null = null;
let isConnecting = false; // Prevent multiple simultaneous connection attempts
let isInitialized = false; // Track if forwarder has been started
let connectionLock: Promise<void> | null = null;

// Maximum queue size to prevent unbounded memory growth
const MAX_QUEUE_SIZE = 1000;
let droppedMessageCount = 0;

function getSessionId(): string {
  if (sessionId) {
    return sessionId;
  }
  const key = 'geoasteroids-session-id';
  sessionId = getStoredItem(key);
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    setStoredItem(key, sessionId);
  }
  return sessionId;
}

export function getLogsWebSocketUrl(): string {
  try {
    const gameplay =
      typeof import.meta !== 'undefined'
        ? (import.meta.env?.VITE_WEBSOCKET_URL as string | undefined)
        : undefined;
    const isSecure = typeof location !== 'undefined' && location.protocol === 'https:';
    const host =
      typeof location !== 'undefined' ? location.host || location.hostname : 'localhost:3001';
    return logsWebSocketUrlFromGameplay(gameplay, host, isSecure);
  } catch {
    return 'ws://localhost:3001/logs';
  }
}

function connectWebSocket(): void {
  // Prevent multiple simultaneous connection attempts using a lock
  if (connectionLock) {
    return;
  }

  connectionLock = (async () => {
    try {
      // Double-check connection state after acquiring lock
      if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
        return;
      }

      isConnecting = true;

      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        isConnecting = false;
        return;
      }
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onopen = null;
        try {
          ws.close();
        } catch {
          // Previous socket already dead.
        }
        ws = null;
      }

      const wsUrl = getLogsWebSocketUrl();
      logger.info('LOG_FORWARD', 'Attempting to connect to WebSocket', { wsUrl });

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        isConnecting = false;
        logger.info('LOG_FORWARD', 'WebSocket connected to server');

        // Send any queued messages
        while (messageQueue.length > 0) {
          const message = messageQueue.shift();
          if (message && ws && ws.readyState === WebSocket.OPEN) {
            sendLogMessage(message);
          }
        }
      };

      ws.onclose = (event) => {
        isConnecting = false;
        logger.warn('LOG_FORWARD', 'WebSocket disconnected from server', {
          code: event.code,
          reason: event.reason,
        });

        // Only attempt to reconnect if we haven't been stopped
        if (isInitialized && reconnectTimer === null) {
          reconnectTimer = window.setTimeout(() => {
            logger.info('LOG_FORWARD', 'Attempting to reconnect...');
            reconnectTimer = null;
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        isConnecting = false;
        logger.error(
          'LOG_FORWARD',
          'WebSocket error',
          error instanceof Error ? error : new Error(String(error))
        );
      };
    } catch (error) {
      isConnecting = false;
      logger.error(
        'LOG_FORWARD',
        'Failed to create WebSocket',
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      connectionLock = null;
    }
  })();
}

function sendLogMessage(message: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    // Queue message for later if not connected, enforcing maximum size
    if (messageQueue.length >= MAX_QUEUE_SIZE) {
      // Drop oldest message to make room
      messageQueue.shift();
      droppedMessageCount++;

      // Log warning when messages are dropped
      if (droppedMessageCount % 100 === 1) {
        // Log every 100th drop to avoid spam
        logger.warn(
          'LOG_FORWARD',
          `Message queue at capacity, dropped ${droppedMessageCount} messages`
        );
      }
    }

    messageQueue.push(message);
    return;
  }

  try {
    const sid = getSessionId();
    const ua = navigator.userAgent;
    const pageUrl = location.href;

    // Parse the message to extract log level and content
    const levelMatch = message.match(/\[.*?\]\s+(\w+)\s+\[.*?\]/);
    const level: ClientLogLevel = (levelMatch?.[1] as ClientLogLevel) || 'INFO';

    ws.send(
      JSON.stringify({
        type: 'clientLog',
        timestamp: Date.now(),
        data: {
          sessionId: sid,
          level,
          line: message,
          message,
          userAgent: ua,
          pageUrl,
        },
      })
    );
  } catch (error) {
    logger.warn('LOG_FORWARD', 'Failed to send log message', { error });
  }
}

// Start the log forwarder (establishes WebSocket connection)
export function startClientLogForwarder(): void {
  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }

  isInitialized = true;
  logger.info('LOG_FORWARD', 'startClientLogForwarder called, attempting to connect...');
  connectWebSocket();
}

// Stop the log forwarder
export function stopClientLogForwarder(): void {
  isInitialized = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  messageQueue = [];
}

// Direct forwarding function for Logger to use
export function forwardLogToServer(message: string): void {
  sendLogMessage(message);
}
