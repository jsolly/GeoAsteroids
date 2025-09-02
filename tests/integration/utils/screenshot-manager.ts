import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export class ScreenshotManager {
  private readonly screenshotsDir: string;

  constructor(testDir: string) {
    this.screenshotsDir = join(testDir, 'screenshots');
  }

  /**
   * Clear the screenshots directory and recreate it
   */
  clearScreenshots(): void {
    try {
      if (existsSync(this.screenshotsDir)) {
        rmSync(this.screenshotsDir, { recursive: true, force: true });
      }
      mkdirSync(this.screenshotsDir, { recursive: true });
      console.log('🧹 Cleared screenshots directory');
    } catch (error) {
      console.log('⚠️ Could not clear screenshots directory:', error);
    }
  }

  /**
   * Generate a timestamped filename
   */
  getTimestampedFilename(prefix: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.png`;
  }

  /**
   * Get the full path for a screenshot
   */
  getScreenshotPath(filename: string): string {
    return join(this.screenshotsDir, filename);
  }

  /**
   * Get the screenshots directory path
   */
  getScreenshotsDir(): string {
    return this.screenshotsDir;
  }
}
