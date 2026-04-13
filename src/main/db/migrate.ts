import fs from 'node:fs';
import path from 'node:path';
import type { DB } from './connection';

interface MigrationFile { id: number; filename: string; sql: string }

export function loadMigrations(dir: string): MigrationFile[] {
  const files = fs.readdirSync(dir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  return files.map(filename => {
    const id = Number(filename.split('_')[0]);
    const sql = fs.readFileSync(path.join(dir, filename), 'utf8');
    return { id, filename, sql };
  });
}

export function runMigrations(db: DB, migrations: MigrationFile[]): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);`);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r: any) => r.id as number),
  );
  const apply = db.transaction((m: MigrationFile) => {
    db.exec(m.sql);
    db.prepare('INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)')
      .run(m.id, Date.now());
  });
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    apply(m);
  }
}
