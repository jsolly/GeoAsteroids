import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_LOG_PATH = join(process.cwd(), 'logs', 'server.log');

/** Track server.log line offsets so assertions ignore earlier suite output. */
export class ServerLogHelper {
  static markLineOffset(): number {
    return this.readLines().length;
  }

  static linesSince(lineOffset: number): string[] {
    return this.readLines().slice(lineOffset);
  }

  static findMatchingLinesSince(lineOffset: number, pattern: RegExp): string[] {
    return this.linesSince(lineOffset).filter((line) => pattern.test(line));
  }

  private static readLines(): string[] {
    try {
      return readFileSync(SERVER_LOG_PATH, 'utf-8').split('\n');
    } catch {
      return [];
    }
  }
}
