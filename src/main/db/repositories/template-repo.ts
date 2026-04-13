import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Template, UUID } from '@shared/types/domain';

interface Row {
  id: string; name: string; shared_prompt: string;
  created_at: number; updated_at: number;
}

const toTemplate = (r: Row): Template => ({
  id: r.id, name: r.name, sharedPrompt: r.shared_prompt,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export class TemplateRepo {
  constructor(private db: DB) {}

  create(name: string): Template {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO templates (id, name, shared_prompt, created_at, updated_at)
       VALUES (?, ?, '', ?, ?)`,
    ).run(id, name, now, now);
    return this.get(id)!;
  }

  list(): Template[] {
    return (this.db.prepare(
      `SELECT * FROM templates ORDER BY created_at DESC, id DESC`,
    ).all() as Row[]).map(toTemplate);
  }

  get(id: UUID): Template | null {
    const r = this.db.prepare(`SELECT * FROM templates WHERE id = ?`).get(id) as Row | undefined;
    return r ? toTemplate(r) : null;
  }

  update(id: UUID, patch: Partial<Pick<Template, 'name' | 'sharedPrompt'>>): Template {
    const existing = this.get(id);
    if (!existing) throw new Error(`Template not found: ${id}`);
    const name = patch.name ?? existing.name;
    const sharedPrompt = patch.sharedPrompt ?? existing.sharedPrompt;
    const now = Date.now();
    this.db.prepare(
      `UPDATE templates SET name = ?, shared_prompt = ?, updated_at = ? WHERE id = ?`,
    ).run(name, sharedPrompt, now, id);
    return this.get(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
  }
}
