import { dialog } from 'electron';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AppContext } from '../app-context';
import { broadcast, handle } from './register';

export function registerGenerationIpc(ctx: AppContext): void {
  handle('generation:runMany', ({ jobIds }) => {
    const batchId = randomUUID();
    const runner = ctx.makeBatchRunner(ev => broadcast('generation:update', ev));
    void runner.runMany(jobIds);
    return { batchId };
  });

  handle('generation:listByJob', ({ jobId }) => ctx.generations.listByJob(jobId));

  handle('generation:export', async ({ generationId }) => {
    const gen = ctx.generations.getById(generationId);
    if (!gen || !gen.resultAssetId) throw new Error('Generation has no result to export.');
    const job = ctx.jobs.getById(gen.jobId);
    const template = job ? ctx.templates.get(job.templateId) : null;

    const { bytes, mimeType } = ctx.assetStore.readBytes(gen.resultAssetId);
    const ext = mimeType === 'image/png' ? 'png'
              : mimeType === 'image/jpeg' ? 'jpg'
              : mimeType === 'image/webp' ? 'webp'
              : 'bin';
    const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
    const ts = new Date(gen.startedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
    const defaultName = `${safe(template?.name ?? 'template')}_${safe(job?.name ?? 'job')}_${stamp}.${ext}`;

    const r = await dialog.showSaveDialog({ defaultPath: defaultName });
    if (r.canceled || !r.filePath) return { cancelled: true } as const;
    fs.writeFileSync(r.filePath, bytes);
    return { savedPath: r.filePath };
  });
}
