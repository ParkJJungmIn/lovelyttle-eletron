import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { AssetRepo } from './asset-repo';
import { TemplateRepo } from './template-repo';
import { SlotRepo } from './slot-repo';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  const assets = new AssetRepo(db);
  const templates = new TemplateRepo(db);
  const slots = new SlotRepo(db);
  const asset = assets.findOrCreate({ contentHash: 'h', mimeType: 'image/png', byteSize: 10, originalFilename: null });
  const template = templates.create('T');
  return { slots, asset, template };
}

describe('SlotRepo', () => {
  it('creates a slot under a template', () => {
    const { slots, asset, template } = setup();
    const s = slots.create({
      ownerKind: 'template', ownerId: template.id,
      assetId: asset.id, variableName: 'imageA', description: 'desc', position: 0,
    });
    expect(s.variableName).toBe('imageA');
    expect(slots.listByOwner('template', template.id).length).toBe(1);
  });

  it('rejects duplicate variable names within same owner', () => {
    const { slots, asset, template } = setup();
    slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'imageA', description: '', position: 0 });
    expect(() => slots.create({
      ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'imageA', description: '', position: 1,
    })).toThrow();
  });

  it('orders listByOwner by position asc', () => {
    const { slots, asset, template } = setup();
    slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'b', description: '', position: 2 });
    slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'a', description: '', position: 0 });
    expect(slots.listByOwner('template', template.id).map(s => s.variableName)).toEqual(['a', 'b']);
  });

  it('updates variableName, description, position', () => {
    const { slots, asset, template } = setup();
    const s = slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'x', description: '', position: 0 });
    const u = slots.update(s.id, { variableName: 'y', description: 'hello', position: 5 });
    expect(u.variableName).toBe('y');
    expect(u.description).toBe('hello');
    expect(u.position).toBe(5);
  });

  it('deletes a slot', () => {
    const { slots, asset, template } = setup();
    const s = slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'x', description: '', position: 0 });
    slots.delete(s.id);
    expect(slots.listByOwner('template', template.id)).toEqual([]);
  });
});
