import type { AppContext } from '../app-context';
import { handle } from './register';
import { composePrompt } from '@shared/prompt-compose';

export function registerPromptIpc(ctx: AppContext): void {
  handle('prompt:compose', ({ jobId }) => {
    const job = ctx.jobs.getById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    const template = ctx.templates.get(job.templateId);
    if (!template) throw new Error(`Template not found: ${job.templateId}`);

    const result = composePrompt({
      template: { sharedPrompt: template.sharedPrompt, slots: ctx.slots.listByOwner('template', template.id) },
      job: { prompt: job.prompt, slots: ctx.slots.listByOwner('job', job.id) },
    });

    return {
      finalPrompt: result.finalPrompt,
      warnings: result.warnings,
      imageRefs: result.imageRefs.map(r => ({
        variableName: r.variableName,
        description: r.description,
        assetId: r.assetId,
        originalFilename: ctx.assets.getById(r.assetId)?.originalFilename ?? null,
      })),
    };
  });
}
