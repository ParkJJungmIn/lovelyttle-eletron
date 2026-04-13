import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Asset, UUID } from '@shared/types/domain';

interface Row {
  id: string; content_hash: string; mime_type: string;
  byte_size: number; original_filename: string | null; created_at: number;
}

const toAsset = (r: Row): Asset => ({
  id: r.id, contentHash: r.content_hash, mimeType: r.mime_type,
  byteSize: r.byte_size, originalFilename: r.original_filename, createdAt: r.created_at,
});

export interface AssetCreateInput {
  contentHash: string;
  mimeType: string;
  byteSize: number;
  originalFilename: string | null;
}

export class AssetRepo {
  constructor(private db: DB) {}

  getById(id: UUID): Asset | null {
    const r = this.db.prepare(`SELECT * FROM assets WHERE id = ?`).get(id) as Row | undefined;
    return r ? toAsset(r) : null;
  }

  getByHash(hash: string): Asset | null {
    const r = this.db.prepare(`SELECT * FROM assets WHERE content_hash = ?`).get(hash) as Row | undefined;
    return r ? toAsset(r) : null;
  }

  findOrCreate(input: AssetCreateInput): Asset {
    const existing = this.getByHash(input.contentHash);
    if (existing) return existing;
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO assets (id, content_hash, mime_type, byte_size, original_filename, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.contentHash, input.mimeType, input.byteSize, input.originalFilename, Date.now());
    return this.getById(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM assets WHERE id = ?`).run(id);
  }
}
