import type { RoidBelt } from '../../entities/roid/Roid';
import { isDebugMode } from '../../utils/debugUtils';

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
    console.warn(
      'enableDebugMode() is deprecated - debug mode is now controlled via VITE_CLIENT_LOG_LEVEL=debug'
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

      // Apply roid count from env var
      if (debugConfig.debugRoidCount !== 10) {
        roidBelt.setRoidLimits(debugConfig.debugRoidCount, debugConfig.debugRoidCount);
        // Clear and recreate roids to match the new count
        roidBelt.roids = [];
        for (let i = 0; i < debugConfig.debugRoidCount; i++) {
          roidBelt.addRoid();
        }
      }

      // Store debug config for any other systems that need it
      (roidBelt as DebugRoidBelt).debugConfig = debugConfig;
    } catch (error) {
      console.error('Error applying debug config:', error);
    }
  }

  private getDebugConfig(): DebugConfig {
    return {
      botCount: parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10),
      debugRoidCount: parseInt(import.meta.env.VITE_DEBUG_ROID_COUNT || '100', 10),
    };
  }
}
