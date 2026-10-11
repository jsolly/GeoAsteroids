import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** Each diagnostic log keeps at most this many bytes plus one `.1` predecessor. */
const LOG_FILE_MAX_BYTES = 10 * 1024 * 1024;

export function logsDirectory(): string {
  return process.env['GEOROIDS_TEST_LOG_DIR'] ?? path.join(process.cwd(), 'logs');
}

function missingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** A size-capped append target; the byte count is read once and then tracked in memory. */
export class RotatingLogFile {
  private bytes: number | null = null;

  constructor(private readonly name: string) {}

  /** Resolved per call so a test log directory set after import still applies. */
  get path(): string {
    return path.join(logsDirectory(), this.name);
  }

  /** Rotate before a write that would exceed the cap; `beforeRename` releases an open stream. */
  async rotateFor(nextBytes: number, beforeRename?: () => Promise<void>): Promise<void> {
    const filePath = this.path;
    if ((await this.size(filePath)) + nextBytes <= LOG_FILE_MAX_BYTES) {
      return;
    }
    await beforeRename?.();
    await fs.rm(`${filePath}.1`, { force: true });
    try {
      await fs.rename(filePath, `${filePath}.1`);
    } catch (error) {
      if (!missingFile(error)) {
        throw error;
      }
    }
    this.bytes = 0;
  }

  recordWritten(bytes: number): void {
    this.bytes = (this.bytes ?? 0) + bytes;
  }

  private async size(filePath: string): Promise<number> {
    if (this.bytes !== null) {
      return this.bytes;
    }
    try {
      this.bytes = (await fs.stat(filePath)).size;
    } catch (error) {
      if (!missingFile(error)) {
        throw error;
      }
      this.bytes = 0;
    }
    return this.bytes;
  }
}
