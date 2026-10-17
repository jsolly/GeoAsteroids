import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const REPORT_ID = /^Report: ([0-9a-f-]{36})$/imu;
const MANIFEST = /^Bundle: (\d+) bytes, SHA-256 ([0-9a-f]{64})$/mu;
const PART_HEADER = /^GeoRoids diagnostic bundle ([0-9a-f-]{36}) (\d+)\/(\d+)\n/u;
const READY =
  /^VERIFIED READY: all numbered comments were reread and matched the bundle hash and size\.$/mu;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Verify an exported task plus every comment page before reading untrusted diagnostic data. */
export function readDebugReport(input: unknown): unknown {
  if (
    !object(input) ||
    typeof input['description'] !== 'string' ||
    !Array.isArray(input['comments'])
  ) {
    throw new Error('Expected a task description and all comment objects');
  }
  // Visitor prose can quote earlier reports; only the generated trailing block owns metadata.
  const fullDescription = input['description'];
  const footerStart = fullDescription.lastIndexOf('\n\nReport: ');
  const description = footerStart >= 0 ? fullDescription.slice(footerStart + 2) : fullDescription;
  const id = REPORT_ID.exec(description)?.[1];
  const manifest = MANIFEST.exec(description);
  if (!id || !manifest || !READY.test(description)) {
    throw new Error('Report is not verified ready or its manifest is missing');
  }
  const parts = new Map<number, string>();
  let total = 0;
  for (const comment of input['comments']) {
    if (!object(comment) || typeof comment['content'] !== 'string') {
      throw new Error('Invalid comment export');
    }
    const header = PART_HEADER.exec(comment['content']);
    if (!header || header[1] !== id) {
      continue;
    }
    const index = Number(header[2]);
    const count = Number(header[3]);
    if (
      index < 1 ||
      count < 1 ||
      count > 500 ||
      index > count ||
      parts.has(index) ||
      (total !== 0 && total !== count)
    ) {
      throw new Error('Diagnostic parts are duplicated or inconsistent');
    }
    total = count;
    parts.set(index, comment['content'].slice(header[0].length));
  }
  if (!total || parts.size !== total) {
    throw new Error('Diagnostic parts are missing');
  }
  const bundle = Array.from({ length: total }, (_, index) => parts.get(index + 1)).join('');
  const hash = createHash('sha256').update(bundle).digest('hex');
  if (Buffer.byteLength(bundle) !== Number(manifest[1]) || hash !== manifest[2]) {
    throw new Error('Diagnostic byte count or SHA-256 does not match');
  }
  const parsed: unknown = JSON.parse(bundle);
  if (!object(parsed) || parsed['id'] !== id) {
    throw new Error('Diagnostic bundle identity does not match');
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const path = process.argv[2];
    if (!path || process.argv.length !== 3) {
      throw new Error('Usage: node --import tsx scripts/read-debug-report.ts TASK_EXPORT.json');
    }
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    process.stdout.write(`${JSON.stringify(readDebugReport(data), null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid debug report export');
    process.exitCode = 1;
  }
}
