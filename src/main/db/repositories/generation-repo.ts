import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Generation, GenerationStatus, ImageRefSnapshot, UUID } from '@shared/types/domain';

interface Row {
  id: string; job_id: string; status: GenerationStatus;
  final_prompt: string; image_refs_json: string;
  result_asset_id: string | null; error_message: string | null;
  model: string; started_at: number; finished_at: number | null;
}

const toGen = (r: Row): Generation => ({
  id: r.id, jobId: r.job_id, status: r.status,
  finalPrompt: r.final_prompt,
  imageRefs: JSON.parse(r.image_refs_json) as ImageRefSnapshot[],
  resultAssetId: r.result_asset_id, errorMessage: r.error_message,
  model: r.model, startedAt: r.started_at, finishedAt: r.finished_at,
});

export class GenerationRepo {
  constructor(private db: DB) {}

  createPending(input: { jobId: UUID; finalPrompt: string; imageRefs: ImageRefSnapshot[]; model: string }): Generation {
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO generations (id, job_id, status, final_prompt, image_refs_json, model, started_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
    ).run(id, input.jobId, input.finalPrompt, JSON.stringify(input.imageRefs), input.model, Date.now());
    return this.getById(id)!;
  }

  getById(id: UUID): Generation | null {
    const r = this.db.prepare(`SELECT * FROM generations WHERE id = ?`).get(id) as Row | undefined;
    return r ? toGen(r) : null;
  }

  listByJob(jobId: UUID): Generation[] {
    return (this.db.prepare(
      `SELECT * FROM generations WHERE job_id = ? ORDER BY started_at DESC, id DESC`,
    ).all(jobId) as Row[]).map(toGen);
  }

  private setStatus(id: UUID, status: GenerationStatus, extra: { resultAssetId?: string; errorMessage?: string; setFinished: boolean }) {
    const finished = extra.setFinished ? Date.now() : null;
    this.db.prepare(
      `UPDATE generations SET status = ?, result_asset_id = COALESCE(?, result_asset_id),
         error_message = COALESCE(?, error_message), finished_at = COALESCE(?, finished_at)
       WHERE id = ?`,
    ).run(status, extra.resultAssetId ?? null, extra.errorMessage ?? null, finished, id);
    return this.getById(id)!;
  }

  markRunning(id: UUID): Generation {
    return this.setStatus(id, 'running', { setFinished: false });
  }

  markSucceeded(id: UUID, resultAssetId: UUID): Generation {
    return this.setStatus(id, 'succeeded', { resultAssetId, setFinished: true });
  }

  markFailed(id: UUID, errorMessage: string): Generation {
    return this.setStatus(id, 'failed', { errorMessage, setFinished: true });
  }

  listReferencedAssetIds(): Set<UUID> {
    const refs = this.db.prepare(`SELECT DISTINCT result_asset_id FROM generations WHERE result_asset_id IS NOT NULL`).all() as { result_asset_id: string }[];
    const fromRefs = new Set(refs.map(r => r.result_asset_id));
    const snapshots = this.db.prepare(`SELECT image_refs_json FROM generations`).all() as { image_refs_json: string }[];
    for (const s of snapshots) {
      for (const ref of JSON.parse(s.image_refs_json) as ImageRefSnapshot[]) fromRefs.add(ref.assetId);
    }
    return fromRefs;
  }
}
