import { isAbsolute } from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import {
  legacyWorldDigest,
  migrateCooperativeWorld,
  readCooperativeWorld,
} from '../server/world/cooperativeSchema';

const [mode, path, expectedDigest, backupPath] = process.argv.slice(2);
if (
  !['inspect', 'dry-run', 'apply', 'activate'].includes(mode ?? '') ||
  !path ||
  !isAbsolute(path)
) {
  throw new Error(
    'Usage: tsx scripts/migrate-cooperative-world.ts inspect|dry-run|apply|activate /absolute/world.sqlite [expected-sha256] [/absolute/backup.sqlite]'
  );
}
const db = new DatabaseSync(path, { readOnly: mode === 'inspect' || mode === 'dry-run' });
try {
  const digest = legacyWorldDigest(db);
  const cooperative = readCooperativeWorld(db);
  if (mode === 'apply') {
    if (
      expectedDigest !== digest ||
      !backupPath ||
      !isAbsolute(backupPath) ||
      backupPath === path
    ) {
      throw new Error('Apply requires the inspected legacy SHA256 and a new absolute backup path');
    }
    // VACUUM INTO includes committed WAL content and refuses an existing backup file.
    db.prepare('VACUUM INTO ?').run(backupPath);
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    try {
      if (legacyWorldDigest(backup) !== digest) {
        throw new Error('Backup verification failed');
      }
    } finally {
      backup.close();
    }
    migrateCooperativeWorld(db, digest);
  } else if (mode === 'activate') {
    if (!cooperative || expectedDigest !== digest) {
      throw new Error('Activation requires migrated schema and current inspection SHA256');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      if (legacyWorldDigest(db) !== expectedDigest) {
        throw new Error('World changed since inspection');
      }
      db.exec('UPDATE cooperative_schema SET activated=1 WHERE version=1');
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) {
        db.exec('ROLLBACK');
      }
      throw error;
    }
  }
  process.stdout.write(
    `${JSON.stringify({
      mode,
      path,
      legacyDigest: digest,
      cooperative: readCooperativeWorld(db)
        ? { schemaVersion: 1, activated: readCooperativeWorld(db)?.activated }
        : null,
      ...(mode === 'apply' ? { backupPath } : {}),
      legacyRowsPreserved: legacyWorldDigest(db) === digest,
    })}\n`
  );
} finally {
  db.close();
}
