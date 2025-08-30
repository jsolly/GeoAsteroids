// Client log forwarder: streams console buffer lines to server via WebSocket
// Minimal, self-contained, avoids extra deps and heavy coupling

import { getLogsAsText } from './logLevel';

type ClientLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let forwardTimer: number | null = null;
let lastSentLength = 0;
let sessionId: string | null = null;

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

function sendChunk(lines: string[]): void {
  let ws: WebSocket | null = null;
  let connectionEstablished = false;
  let messageSent = false;
  let retryCount = 0;
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay

  const attemptConnection = () => {
    try {
      // Always use logs endpoint for client log forwarding
      const wsUrl = getLogsWebSocketUrl();

      // Create WebSocket and set up event handlers immediately
      ws = new WebSocket(wsUrl);

      console.debug('LOG_FORWARD', 'WebSocket created', {
        url: wsUrl,
        readyState: ws.readyState,
        connectionEstablished,
        messageSent,
        retryCount,
      });

      // Handle connection errors - only close if we haven't established connection
      ws.onerror = (error) => {
        console.warn('LOG_FORWARD', 'WebSocket connection error', {
          error,
          readyState: ws?.readyState,
          connectionEstablished,
          messageSent,
          retryCount,
        });
        // Only close if we haven't established the connection yet
        if (ws && !connectionEstablished && ws.readyState !== WebSocket.CLOSED) {
          console.debug(
            'LOG_FORWARD',
            'Closing WebSocket due to error before connection established'
          );
          ws.close();
        }
      };

      ws.onopen = () => {
        console.debug('LOG_FORWARD', 'WebSocket connection opened', { readyState: ws?.readyState });
        connectionEstablished = true;

        try {
          const sid = getSessionId();
          const ua = navigator.userAgent;
          const pageUrl = location.href;

          for (const raw of lines) {
            // Parse our buffer line format: [ISO] LEVEL rest
            const match = raw.match(/^\[(.*?)\]\s+(DEBUG|INFO|WARN|ERROR)\s+(.*)$/);
            const level: ClientLogLevel = (match?.[2] as ClientLogLevel) || 'INFO';
            const message = match?.[3] || raw;

            // Send as one message per line to keep server simple
            ws?.send(
              JSON.stringify({
                type: 'clientLog',
                timestamp: Date.now(),
                data: {
                  sessionId: sid,
                  level,
                  line: raw,
                  message,
                  userAgent: ua,
                  pageUrl,
                },
              })
            );
          }

          messageSent = true;

          // Close after sending to avoid long-lived extra socket
          // Add a small delay to ensure message is sent
          setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          }, 100);
        } catch (sendError) {
          console.warn('LOG_FORWARD', 'Failed to send log messages', { error: sendError });
          // Close socket on send error
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
          }
        }
      };

      // Handle connection close
      ws.onclose = () => {
        // Only log if we didn't successfully send the message
        if (!messageSent) {
          console.warn('LOG_FORWARD', 'WebSocket closed before message could be sent');

          // Retry connection if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = baseDelay * 2 ** (retryCount - 1); // Exponential backoff
            console.debug(
              'LOG_FORWARD',
              `Retrying connection in ${delay}ms (attempt ${retryCount}/${maxRetries})`
            );

            setTimeout(() => {
              attemptConnection();
            }, delay);
          } else {
            console.warn('LOG_FORWARD', 'Max retries exceeded, giving up on this log chunk');
          }
        }
      };
    } catch (error) {
      // Best-effort; log locally
      console.warn('LOG_FORWARD', 'Failed to create WebSocket for client log chunk', { error });

      // Retry on creation failure if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = baseDelay * 2 ** (retryCount - 1);
        console.debug(
          'LOG_FORWARD',
          `Retrying connection creation in ${delay}ms (attempt ${retryCount}/${maxRetries})`
        );

        setTimeout(() => {
          attemptConnection();
        }, delay);
      }
    }
  };

  // Start the connection attempt
  attemptConnection();
}

export function startClientLogForwarder(): void {
  if (forwardTimer !== null) {
    return;
  }

  // Set global flag so Logger can use it
  (window as { __logForwarderEnabled?: boolean }).__logForwarderEnabled = true;

  // Emit a startup marker for verification
  try {
    const iso = new Date().toISOString();
    sendChunk([`[${iso}] INFO LOG_FORWARD Forwarder started`]);

    // Also test with a simple log message
    console.info('LOG_FORWARD', 'This is a test log message to verify forwarding works');
  } catch {}

  // Flush on interval with backpressure limits
  forwardTimer = window.setInterval(() => {
    const text = getLogsAsText();
    if (!text) {
      return;
    }
    const allLines = text.split('\n');

    if (allLines.length <= lastSentLength) {
      return;
    }

    const newLines = allLines.slice(lastSentLength);
    // Cap per batch to keep payloads small
    const batch = newLines.slice(0, 200);
    lastSentLength += batch.length;

    if (batch.length > 0) {
      sendChunk(batch);
    }
  }, 2000);
}

// Direct forwarding function for Logger to use
export function forwardLogToServer(message: string): void {
  let ws: WebSocket | null = null;
  let messageSent = false;
  let connectionEstablished = false;
  let retryCount = 0;
  const maxRetries = 2; // Fewer retries for single messages
  const baseDelay = 500; // Shorter delay for single messages

  const attemptConnection = () => {
    try {
      const wsUrl = getLogsWebSocketUrl();
      ws = new WebSocket(wsUrl);

      ws.onerror = (error) => {
        console.warn('LOG_FORWARD', 'WebSocket connection error in forwardLogToServer', { error });
        if (ws && !connectionEstablished && ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
      };

      ws.onopen = () => {
        connectionEstablished = true;

        try {
          const sid = getSessionId();
          const ua = navigator.userAgent;
          const pageUrl = location.href;

          ws?.send(
            JSON.stringify({
              type: 'clientLog',
              timestamp: Date.now(),
              data: {
                sessionId: sid,
                level: 'INFO',
                line: message,
                message,
                userAgent: ua,
                pageUrl,
              },
            })
          );

          messageSent = true;

          // Close after sending to avoid long-lived extra socket
          // Add a small delay to ensure message is sent
          setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          }, 100);
        } catch (sendError) {
          console.warn('LOG_FORWARD', 'Failed to send log message', { error: sendError });
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
          }
        }
      };

      ws.onclose = () => {
        if (!messageSent) {
          console.warn(
            'LOG_FORWARD',
            'WebSocket closed before message could be sent in forwardLogToServer'
          );

          // Retry connection if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = baseDelay * 2 ** (retryCount - 1);
            console.debug(
              'LOG_FORWARD',
              `Retrying forwardLogToServer in ${delay}ms (attempt ${retryCount}/${maxRetries})`
            );

            setTimeout(() => {
              attemptConnection();
            }, delay);
          }
        }
      };
    } catch (_error) {
      // Best-effort; ignore errors

      // Retry on creation failure if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = baseDelay * 2 ** (retryCount - 1);
        console.debug(
          'LOG_FORWARD',
          `Retrying forwardLogToServer creation in ${delay}ms (attempt ${retryCount}/${maxRetries})`
        );

        setTimeout(() => {
          attemptConnection();
        }, delay);
      }
    }
  };

  // Start the connection attempt
  attemptConnection();
}

export function stopClientLogForwarder(): void {
  if (forwardTimer !== null) {
    clearInterval(forwardTimer);
    forwardTimer = null;
  }
}
