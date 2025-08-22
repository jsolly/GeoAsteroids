import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { WebSocketCore } from '../server/core';

describe('Server Message Parity', () => {
  let wsCore: WebSocketCore;

  beforeAll(() => {
    wsCore = new WebSocketCore();
  });

  afterAll(() => {
    // Clean up any timers
    wsCore['cleanupStalePlayers']();
  });

  it('should handle join messages with nested data payloads', () => {
    const sentMessages: string[] = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sentMessages.push(data);
      },
    } as unknown as WebSocket;

    const joinMessage = {
      type: 'join',
      data: {
        id: 'test-id',
        name: 'test-name',
        position: { x: 0, y: 0 },
      },
    };

    wsCore.handleClientMessage(joinMessage, mockWs);

    // Verify player was added
    expect(wsCore.getPlayerCount()).toBe(1);
    const player = wsCore.getPlayer('test-id');
    expect(player).toBeDefined();
    expect(player?.name).toBe('test-name');

    // Check that we got the joined message and game state
    expect(sentMessages.length).toBeGreaterThan(0);
    const joinedMessage = sentMessages.find((msg) => {
      const parsed = JSON.parse(msg);
      return parsed.type === 'joined';
    });
    expect(joinedMessage).toBeDefined();

    const parsedJoined = JSON.parse(joinedMessage!);
    expect(parsedJoined.id).toBe('test-id');
    expect(parsedJoined.name).toBe('test-name');
    expect(parsedJoined.timestamp).toBeDefined();
  });

  it('should handle update messages with nested data payloads', () => {
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (_data: string) => {
        // This would be called for broadcasts, but we're not testing that here
      },
    } as unknown as WebSocket;

    // First add a player
    const joinMessage = {
      type: 'join',
      data: {
        id: 'update-test-id',
        name: 'update-test-name',
        position: { x: 0, y: 0 },
      },
    };
    wsCore.handleClientMessage(joinMessage, mockWs);

    // Then update the player
    const updateMessage = {
      type: 'update',
      data: {
        id: 'update-test-id',
        position: { x: 100, y: 200 },
        score: 150,
      },
    };

    wsCore.handleClientMessage(updateMessage, mockWs);

    // Verify player was updated
    const player = wsCore.getPlayer('update-test-id');
    expect(player).toBeDefined();
    expect(player?.score).toBe(150);
  });

  it('should handle top-level id/name fields for backward compatibility', () => {
    const sentMessages: string[] = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sentMessages.push(data);
      },
    } as unknown as WebSocket;

    const joinMessage = {
      type: 'join',
      id: 'top-level-id',
      name: 'top-level-name',
      position: { x: 0, y: 0 },
    };

    wsCore.handleClientMessage(joinMessage, mockWs);

    // Verify player was added
    const player = wsCore.getPlayer('top-level-id');
    expect(player).toBeDefined();
    expect(player?.name).toBe('top-level-name');

    // Check that we got the joined message
    expect(sentMessages.length).toBeGreaterThan(0);
    const joinedMessage = sentMessages.find((msg) => {
      const parsed = JSON.parse(msg);
      return parsed.type === 'joined';
    });
    expect(joinedMessage).toBeDefined();

    const parsedJoined = JSON.parse(joinedMessage!);
    expect(parsedJoined.id).toBe('top-level-id');
    expect(parsedJoined.name).toBe('top-level-name');
  });

  it('should send standardized error messages', () => {
    const sentMessages: string[] = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sentMessages.push(data);
      },
    } as unknown as WebSocket;

    // Send invalid message (missing id)
    const invalidMessage = {
      type: 'update',
      data: {
        position: { x: 0, y: 0 },
      },
    };

    wsCore.handleClientMessage(invalidMessage, mockWs);

    // Verify error was sent
    expect(sentMessages).toHaveLength(1);
    const errorMessage = JSON.parse(sentMessages[0]);
    expect(errorMessage.type).toBe('error');
    expect(errorMessage.data).toBe('Missing player ID');
    expect(errorMessage.timestamp).toBeDefined();
  });
});
