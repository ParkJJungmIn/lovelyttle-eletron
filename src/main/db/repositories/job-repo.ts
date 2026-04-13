import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Job, UUID } from '@shared/types/domain';

interface Row {
  id: string; template_id: string; name: string; prompt: string;
  created_at: number; updated_at: number;
}

const toJob = (r: Row): Job => ({
  id: r.id, templateId: r.template_id, name: r.name,
  prompt: r.prompt, createdAt: r.created_at, updatedAt: r.updated_at,
});

export class JobRepo {
  constructor(private db: DB) {}

  create(input: { templateId: UUID; name: string }): Job {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO jobs (id, template_id, name, prompt, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    ).run(id, input.templateId, input.name, now, now);
    return this.getById(id)!;
  }

  getById(id: UUID): Job | null {
    const r = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as Row | undefined;
    return r ? toJob(r) : null;
  }

  listByTemplate(templateId: UUID): Job[] {
    return (this.db.prepare(
      `SELECT * FROM jobs WHERE template_id = ? ORDER BY created_at DESC, id DESC`,
    ).all(templateId) as Row[]).map(toJob);
  }

  update(id: UUID, patch: Partial<Pick<Job, 'name' | 'prompt'>>): Job {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Job not found: ${id}`);
    const now = Date.now();
    this.db.prepare(
      `UPDATE jobs SET name = ?, prompt = ?, updated_at = ? WHERE id = ?`,
    ).run(patch.name ?? existing.name, patch.prompt ?? existing.prompt, now, id);
    return this.getById(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM jobs WHERE id = ?`).run(id);
  }
}
