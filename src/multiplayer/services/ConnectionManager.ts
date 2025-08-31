import { logger } from '../../utils/Logger';
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
  private clientId: string;

  private constructor() {
    this.state = {
      isConnected: false,
      socket: null,
      reconnectAttempts: 0,
    };
    // Generate a unique client ID for this session
    this.clientId = this.generateClientId();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Get the unique client ID for this session
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    // Use a combination of timestamp and random string for uniqueness
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `client-${timestamp}-${randomPart}`;
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
        logger.debug('MULTIPLAYER', 'Connecting to WebSocket', { url: wsUrl });
        this.state.socket = new WebSocket(wsUrl);

        this.state.socket.onopen = (): void => {
          this.state.isConnected = true;
          this.state.reconnectAttempts = 0;
          logger.debug('MULTIPLAYER', 'Connected to server');
          this.connectionHandlers.onConnect?.();
          resolve();
        };

        // Track if we've already handled connection failure to prevent race conditions
        let connectionFailed = false;

        this.state.socket.onerror = (error: Event): void => {
          if (connectionFailed) {
            return; // Prevent multiple error handling
          }
          connectionFailed = true;

          logger.error('MULTIPLAYER', `WebSocket error: ${error.type}`);
          this.handleConnectionError();
          const connectionError = new Error('WebSocket connection failed');
          this.connectionHandlers.onError?.(connectionError);
          reject(connectionError);
        };

        this.state.socket.onclose = (event: CloseEvent): void => {
          // Only handle disconnection if we haven't already failed the connection
          if (!connectionFailed) {
            this.state.isConnected = false;
            this.state.socket = null;
            logger.debug('MULTIPLAYER', 'Disconnected from server', {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
            });
            this.connectionHandlers.onDisconnect?.();
          } else {
            // Connection already failed, just clean up state
            this.state.isConnected = false;
            this.state.socket = null;
          }
        };

        this.setupMessageHandler();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('MULTIPLAYER', `Failed to connect to multiplayer server: ${errorMessage}`);
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
          logger.debug('MULTIPLAYER', 'Sending client message', {
            type: message.type,
            data: message.data,
          });
        }
        this.state.socket.send(JSON.stringify(message));
      } catch (error) {
        logger.error(
          'MULTIPLAYER',
          `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      logger.warn('MULTIPLAYER', 'Cannot send message - not connected');
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
        let inferredPayload: unknown;

        if (raw.payload !== undefined) {
          // Standard format with explicit payload field
          inferredPayload = raw.payload;
        } else if (raw.data !== undefined) {
          // Alternative format with data field
          inferredPayload = raw.data;
        } else {
          // Fallback: use remaining fields as payload (excluding type and timestamp)
          const payloadFields: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(raw)) {
            if (key !== 'type' && key !== 'timestamp') {
              payloadFields[key] = value;
            }
          }
          inferredPayload = Object.keys(payloadFields).length > 0 ? payloadFields : undefined;
        }

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
          logger.warn('MULTIPLAYER', 'No handler for message type', { type: normalized.type });
        }
      } catch (error) {
        logger.error(
          'MULTIPLAYER',
          `Failed to parse server message: ${String(event.data)}`,
          error instanceof Error ? error : new Error(String(error))
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
      logger.debug(
        'MULTIPLAYER',
        `Attempting reconnection ${this.state.reconnectAttempts}/${this.maxReconnectAttempts}`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          logger.error(
            'MULTIPLAYER',
            `Reconnection failed: ${error instanceof Error ? error.message : String(error)}`
          );
        });
      }, this.reconnectDelay * this.state.reconnectAttempts);
    } else {
      logger.error('MULTIPLAYER', 'Max reconnection attempts reached');
    }
  }
}
