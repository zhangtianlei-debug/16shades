import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:')
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;',
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL) STRICT',
  );
  const directory = new URL('./migrations/', import.meta.url);
  for (const name of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name))
      continue;
    transaction(db, () => {
      db.exec(readFileSync(new URL(name, directory), 'utf8'));
      db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(
        name,
        Date.now(),
      );
    });
  }
  db.exec('PRAGMA optimize');
  return db;
}

export function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function recordMetric(db, event, now = Date.now()) {
  const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  db.prepare(
    'INSERT INTO metric_totals VALUES (?,?,1) ON CONFLICT(day,event) DO UPDATE SET count=count+1',
  ).run(day, event);
}

export function cleanExpired(db, now = Date.now()) {
  for (const table of [
    'sessions',
    'rate_limits',
    'captcha_uses',
    'metric_receipts',
  ]) {
    db.prepare(`DELETE FROM ${table} WHERE expires_at<=?`).run(now);
  }
  db.prepare('DELETE FROM metric_totals WHERE day<?').run(
    new Date(now + 8 * 3600000 - 90 * 86400000).toISOString().slice(0, 10),
  );
}
