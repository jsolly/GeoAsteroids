import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiplayerManager } from '../src/multiplayer/multiplayerManager';

describe('Minimap Server Info', () => {
  let multiplayerManager: MultiplayerManager;

  beforeEach(() => {
    // Reset the singleton instance for each test
    vi.resetModules();
    multiplayerManager = MultiplayerManager.getInstance();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should get server name from localhost websocket URL', () => {
    vi.stubEnv('VITE_WEBSOCKET_URL', 'ws://localhost:3001/ws');
    const serverName = multiplayerManager.getServerName();
    expect(serverName).toBe('Local Server (3001)');
  });

  it('should get connection status when disconnected', () => {
    const status = multiplayerManager.getConnectionStatus();
    expect(status).toBe('disconnected');
  });

  it('should handle malformed websocket URL gracefully', () => {
    // Mock a malformed URL
    vi.stubEnv('VITE_WEBSOCKET_URL', 'invalid-url');

    const serverName = multiplayerManager.getServerName();
    expect(serverName).toBe('Unknown Server');
  });

  it('should handle missing websocket URL', () => {
    // Mock missing URL
    vi.stubEnv('VITE_WEBSOCKET_URL', '');

    const serverName = multiplayerManager.getServerName();
    expect(serverName).toBe('Unknown Server');
  });
});
