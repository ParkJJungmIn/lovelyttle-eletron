import type { UUID } from '@shared/types/domain';
import { composePrompt } from '@shared/prompt-compose';
import type { TemplateRepo } from '../db/repositories/template-repo';
import type { JobRepo } from '../db/repositories/job-repo';
import type { SlotRepo } from '../db/repositories/slot-repo';
import type { GenerationRepo } from '../db/repositories/generation-repo';
import type { AssetStore } from './asset-store';
import type { IGenerationService } from './generation/IGenerationService';

export interface BatchUpdateEvent {
  generationId: UUID;
  jobId: UUID;
  status: 'running' | 'succeeded' | 'failed';
  resultAssetId?: UUID;
  errorMessage?: string;
}

export interface BatchRunnerDeps {
  templates: TemplateRepo;
  jobs: JobRepo;
  slots: SlotRepo;
  generations: GenerationRepo;
  assetStore: AssetStore;
  generationService: IGenerationService;
  maxConcurrent: number;
  model: string;
  emit: (e: BatchUpdateEvent) => void;
}

export class BatchRunner {
  constructor(private deps: BatchRunnerDeps) {}

  async runMany(jobIds: UUID[]): Promise<void> {
    const queue = [...jobIds];
    const workers: Promise<void>[] = [];
    const slots = Math.min(this.deps.maxConcurrent, queue.length);
    for (let i = 0; i < slots; i++) workers.push(this.worker(queue));
    await Promise.all(workers);
  }

  private async worker(queue: UUID[]): Promise<void> {
    while (queue.length > 0) {
      const jobId = queue.shift();
      if (!jobId) return;
      await this.runOne(jobId);
    }
  }

  private async runOne(jobId: UUID): Promise<void> {
    const { templates, jobs, slots, generations, assetStore, generationService, model, emit } = this.deps;
    const job = jobs.getById(jobId);
    if (!job) return;
    const template = templates.get(job.templateId);
    if (!template) return;

    const composed = composePrompt({
      template: { sharedPrompt: template.sharedPrompt, slots: slots.listByOwner('template', template.id) },
      job: { prompt: job.prompt, slots: slots.listByOwner('job', job.id) },
    });

    const pending = generations.createPending({
      jobId: job.id,
      finalPrompt: composed.finalPrompt,
      imageRefs: composed.imageRefs.map(r => ({ variableName: r.variableName, assetId: r.assetId, description: r.description })),
      model,
    });

    generations.markRunning(pending.id);
    emit({ generationId: pending.id, jobId: job.id, status: 'running' });

    try {
      const images = composed.imageRefs.map(r => {
        const { bytes, mimeType } = assetStore.readBytes(r.assetId);
        return { variableName: r.variableName, description: r.description, bytes, mimeType };
      });
      const result = await generationService.generate({
        finalPrompt: composed.finalPrompt, images, model,
      });
      const asset = await assetStore.save(result.bytes, result.mimeType, null);
      generations.markSucceeded(pending.id, asset.id);
      emit({ generationId: pending.id, jobId: job.id, status: 'succeeded', resultAssetId: asset.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      generations.markFailed(pending.id, message);
      emit({ generationId: pending.id, jobId: job.id, status: 'failed', errorMessage: message });
    }
  }
}
