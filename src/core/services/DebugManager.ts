import { DEBUG } from '../../constants';
import type { RoidBelt } from '../../entities/roid/Roid';
import { isDebugMode } from '../../utils/debugUtils';
import { logger } from '../../utils/Logger';

interface DebugConfig {
  botCount: number;
  debugRoidCount: number;
}

interface DebugRoidBelt extends RoidBelt {
  debugConfig?: DebugConfig;
}

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
    return isDebugMode();
  }

  applyDebugConfig(roidBelt: RoidBelt): void {
    if (!isDebugMode()) {
      return;
    }

    try {
      const debugConfig = this.getDebugConfig();

      // Apply roid count from env var if different from current count
      const targetRoidCount = debugConfig.debugRoidCount ?? 100; // Default to 100 if not specified
      const currentRoidCount = roidBelt.roids.length;

      if (targetRoidCount !== currentRoidCount) {
        roidBelt.setRoidLimits(targetRoidCount, targetRoidCount);
        // Clear and recreate roids to match the new count
        roidBelt.roids = [];
        for (let i = 0; i < targetRoidCount; i++) {
          roidBelt.addRoid();
        }
      }

      // Store debug config for any other systems that need it
      (roidBelt as DebugRoidBelt).debugConfig = debugConfig;
    } catch (error) {
      logger.error(
        'DEBUG',
        'Error applying debug config',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private getDebugConfig(): DebugConfig {
    return {
      botCount: DEBUG.BOT_COUNT,
      debugRoidCount: DEBUG.ROID_COUNT,
    };
  }
}
