// Client log forwarder: streams individual log messages to server via WebSocket
// Used by Logger.ts for structured logging

import { logger } from './Logger';

type ClientLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let sessionId: string | null = null;
let ws: WebSocket | null = null;
let messageQueue: string[] = [];
let reconnectTimer: number | null = null;
let isConnecting = false; // Prevent multiple simultaneous connection attempts
let isInitialized = false; // Track if forwarder has been started

function getSessionId(): string {
  if (sessionId) {
    return sessionId;
  }
  try {
    const key = 'geoasteroids-session-id';
    sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, sessionId);
    }
  } catch {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return sessionId as string;
}

function getLogsWebSocketUrl(): string {
  try {
    const isSecure = typeof location !== 'undefined' && location.protocol === 'https:';
    const protocol = isSecure ? 'wss' : 'ws';
    const host = typeof location !== 'undefined' ? location.hostname : 'localhost';
    // The multiplayer server listens on 3001 in local/dev; use that port consistently
    const port = 3001;
    return `${protocol}://${host}:${port}/logs`;
  } catch {
    return 'ws://localhost:3001/logs';
  }
}

function connectWebSocket(): void {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;

  try {
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
  }
}

function sendLogMessage(message: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    // Queue message for later if not connected
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
