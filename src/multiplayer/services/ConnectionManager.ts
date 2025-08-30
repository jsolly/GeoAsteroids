import type { ClientMessage, ServerMessage } from '../types';

export interface ConnectionState {
  isConnected: boolean;
  socket: WebSocket | null;
  reconnectAttempts: number;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private state: ConnectionState;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageHandlers: Map<string, (message: ServerMessage) => void> = new Map();
  private connectionHandlers: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  } = {};

  private constructor() {
    this.state = {
      isConnected: false,
      socket: null,
      reconnectAttempts: 0,
    };
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Connect to the multiplayer server
   */
  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.socket) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001/ws';
        console.debug('MULTIPLAYER', 'Connecting to WebSocket', { url: wsUrl });
        this.state.socket = new WebSocket(wsUrl);

        this.state.socket.onopen = (): void => {
          this.state.isConnected = true;
          this.state.reconnectAttempts = 0;
          console.debug('MULTIPLAYER', 'Connected to server');
          this.connectionHandlers.onConnect?.();
          resolve();
        };

        this.state.socket.onerror = (error: Event): void => {
          console.error('MULTIPLAYER', 'WebSocket error', { error: error.type });
          this.handleConnectionError();
          const connectionError = new Error('WebSocket connection failed');
          this.connectionHandlers.onError?.(connectionError);
          reject(connectionError);
        };

        this.state.socket.onclose = (): void => {
          this.state.isConnected = false;
          this.state.socket = null;
          console.debug('MULTIPLAYER', 'Disconnected from server');
          this.connectionHandlers.onDisconnect?.();
        };

        this.setupMessageHandler();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('MULTIPLAYER', 'Failed to connect to multiplayer server', {
          error: errorMessage,
        });
        this.handleConnectionError();
        const connectionError = new Error(errorMessage);
        this.connectionHandlers.onError?.(connectionError);
        reject(connectionError);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.state.socket) {
      this.state.socket.close();
      this.state.socket = null;
      this.state.isConnected = false;
    }
  }

  /**
   * Send a message to the server
   */
  sendMessage(message: ClientMessage): void {
    if (this.state.isConnected && this.state.socket) {
      try {
        // Avoid spamming logs for high-frequency updates
        if (message.type !== 'update') {
          console.debug('MULTIPLAYER', 'Sending client message', {
            type: message.type,
            data: message.data,
          });
        }
        this.state.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('MULTIPLAYER', 'Failed to send message', { error, message });
      }
    } else {
      console.warn('MULTIPLAYER', 'Cannot send message - not connected');
    }
  }

  /**
   * Register a message handler for a specific message type
   */
  registerMessageHandler(messageType: string, handler: (message: ServerMessage) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Set connection event handlers
   */
  setConnectionHandlers(handlers: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): void {
    this.connectionHandlers = handlers;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  private setupMessageHandler(): void {
    if (!this.state.socket) {
      return;
    }

    this.state.socket.onmessage = (event: MessageEvent): void => {
      try {
        const raw = JSON.parse(event.data) as unknown as {
          type: string;
          payload?: unknown;
          data?: unknown;
          timestamp?: number;
          [key: string]: unknown;
        };

        // Normalize server messages to always expose a `payload` field for handlers
        // Server may send: { type, payload } OR { type, data } OR { type, ...fields }
        const inferredPayload =
          raw.payload !== undefined
            ? raw.payload
            : raw.data !== undefined
              ? raw.data
              : (() => {
                  const rest: Record<string, unknown> = { ...raw };
                  delete (rest as Record<string, unknown>).type;
                  delete (rest as Record<string, unknown>).timestamp;
                  return Object.keys(rest).length > 0 ? rest : undefined;
                })();

        const normalized = {
          type: raw.type,
          payload: inferredPayload,
          timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
        } as ServerMessage;

        // Skip very noisy updates

        const handler = this.messageHandlers.get(normalized.type);
        if (handler) {
          handler(normalized);
        } else {
          console.warn('MULTIPLAYER', 'No handler for message type', normalized.type);
        }
      } catch (error) {
        console.error(
          'MULTIPLAYER',
          'Failed to parse server message:',
          error,
          'Raw data:',
          event.data
        );
        // Ignore malformed messages
      }
    };
  }

  private handleConnectionError(): void {
    this.state.isConnected = false;
    this.state.socket = null;

    if (this.state.reconnectAttempts < this.maxReconnectAttempts) {
      this.state.reconnectAttempts++;
      console.debug(
        'MULTIPLAYER',
        `Attempting reconnection ${this.state.reconnectAttempts}/${this.maxReconnectAttempts}`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('MULTIPLAYER', 'Reconnection failed', { error });
        });
      }, this.reconnectDelay * this.state.reconnectAttempts);
    } else {
      console.error('MULTIPLAYER', 'Max reconnection attempts reached');
    }
  }
}
