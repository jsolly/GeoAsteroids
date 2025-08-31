import { logger } from '../../utils/Logger';

export class DebugManager {
  private static instance: DebugManager;

  private constructor() {}

  static getInstance(): DebugManager {
    if (!DebugManager.instance) {
      DebugManager.instance = new DebugManager();
    }
    return DebugManager.instance;
  }

  enableDebugMode(): void {
    logger.warn(
      'DEBUG',
      'enableDebugMode() is deprecated - debug mode is now controlled via LOGGING.GLOBAL_LOG_LEVEL=debug'
    );
  }

  isDebugMode(): boolean {
    return false; // Debug mode disabled in multiplayer-only mode
  }

  applyDebugConfig(_roidBelt: unknown): void {
    // Disabled in multiplayer mode - server is authoritative for all game content
    logger.debug('DEBUG', 'Debug config disabled - multiplayer mode uses server authority');
    return;
  }
}
