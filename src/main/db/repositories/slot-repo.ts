import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { ImageSlot, SlotOwnerKind, UUID } from '@shared/types/domain';

interface Row {
  id: string; owner_kind: SlotOwnerKind; owner_id: string;
  asset_id: string; variable_name: string; description: string;
  position: number; created_at: number;
}

const toSlot = (r: Row): ImageSlot => ({
  id: r.id, ownerKind: r.owner_kind, ownerId: r.owner_id,
  assetId: r.asset_id, variableName: r.variable_name,
  description: r.description, position: r.position,
});

export interface SlotCreateInput {
  ownerKind: SlotOwnerKind; ownerId: UUID;
  assetId: UUID; variableName: string;
  description: string; position: number;
}

export class SlotRepo {
  constructor(private db: DB) {}

  create(input: SlotCreateInput): ImageSlot {
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO image_slots (id, owner_kind, owner_id, asset_id, variable_name, description, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.ownerKind, input.ownerId, input.assetId, input.variableName, input.description, input.position, Date.now());
    return this.getById(id)!;
  }

  getById(id: UUID): ImageSlot | null {
    const r = this.db.prepare(`SELECT * FROM image_slots WHERE id = ?`).get(id) as Row | undefined;
    return r ? toSlot(r) : null;
  }

  listByOwner(kind: SlotOwnerKind, ownerId: UUID): ImageSlot[] {
    return (this.db.prepare(
      `SELECT * FROM image_slots WHERE owner_kind = ? AND owner_id = ? ORDER BY position ASC, created_at ASC`,
    ).all(kind, ownerId) as Row[]).map(toSlot);
  }

  update(id: UUID, patch: Partial<Pick<ImageSlot, 'variableName' | 'description' | 'position'>>): ImageSlot {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Slot not found: ${id}`);
    this.db.prepare(
      `UPDATE image_slots SET variable_name = ?, description = ?, position = ? WHERE id = ?`,
    ).run(
      patch.variableName ?? existing.variableName,
      patch.description ?? existing.description,
      patch.position ?? existing.position,
      id,
    );
    return this.getById(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM image_slots WHERE id = ?`).run(id);
  }

  listReferencedAssetIds(): Set<UUID> {
    const rows = this.db.prepare(`SELECT DISTINCT asset_id FROM image_slots`).all() as { asset_id: string }[];
    return new Set(rows.map(r => r.asset_id));
  }
}
