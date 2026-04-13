import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { AssetRepo } from './asset-repo';

function freshDb() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  return db;
}

describe('AssetRepo', () => {
  let repo: AssetRepo;
  beforeEach(() => { repo = new AssetRepo(freshDb()); });

  it('findOrCreate inserts a new asset on first call', () => {
    const a = repo.findOrCreate({
      contentHash: 'h1', mimeType: 'image/png',
      byteSize: 100, originalFilename: 'a.png',
    });
    expect(a.contentHash).toBe('h1');
    expect(repo.getById(a.id)?.id).toBe(a.id);
  });

  it('findOrCreate returns existing asset with matching hash', () => {
    const first = repo.findOrCreate({
      contentHash: 'h1', mimeType: 'image/png', byteSize: 100, originalFilename: null,
    });
    const second = repo.findOrCreate({
      contentHash: 'h1', mimeType: 'image/png', byteSize: 100, originalFilename: 'ignored.png',
    });
    expect(second.id).toBe(first.id);
  });

  it('getByHash returns null when absent', () => {
    expect(repo.getByHash('nope')).toBeNull();
  });
});
