import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { TemplateRepo } from './template-repo';

function freshDb() {
  const db = openDatabase(':memory:');
  const migrations = loadMigrations(path.resolve(__dirname, '../migrations'));
  runMigrations(db, migrations);
  return db;
}

describe('TemplateRepo', () => {
  let repo: TemplateRepo;
  beforeEach(() => { repo = new TemplateRepo(freshDb()); });

  it('creates and returns a template', () => {
    const t = repo.create('First');
    expect(t.id).toBeTruthy();
    expect(t.name).toBe('First');
    expect(t.sharedPrompt).toBe('');
  });

  it('lists templates newest first', async () => {
    repo.create('A');
    await new Promise(r => setTimeout(r, 2));
    repo.create('B');
    const all = repo.list();
    expect(all.map(t => t.name)).toEqual(['B', 'A']);
  });

  it('updates name and sharedPrompt', () => {
    const t = repo.create('X');
    const u = repo.update(t.id, { name: 'Y', sharedPrompt: 'hi' });
    expect(u.name).toBe('Y');
    expect(u.sharedPrompt).toBe('hi');
  });

  it('deletes a template', () => {
    const t = repo.create('Z');
    repo.delete(t.id);
    expect(repo.get(t.id)).toBeNull();
  });
});
