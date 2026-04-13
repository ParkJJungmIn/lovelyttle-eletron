import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { openDatabase } from '../db/connection';
import { loadMigrations, runMigrations } from '../db/migrate';
import { TemplateRepo } from '../db/repositories/template-repo';
import { JobRepo } from '../db/repositories/job-repo';
import { SlotRepo } from '../db/repositories/slot-repo';
import { AssetRepo } from '../db/repositories/asset-repo';
import { GenerationRepo } from '../db/repositories/generation-repo';
import { AssetStore } from './asset-store';
import { FakeGenerationService } from './generation/FakeGenerationService';
import { BatchRunner } from './batch-runner';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../db/migrations')));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-'));
  const templates = new TemplateRepo(db);
  const jobs = new JobRepo(db);
  const slots = new SlotRepo(db);
  const assets = new AssetRepo(db);
  const generations = new GenerationRepo(db);
  const assetStore = new AssetStore(assets, tempDir);
  const template = templates.create('T');
  const jobIds = Array.from({ length: 5 }, (_, i) => jobs.create({ templateId: template.id, name: `J${i}` }).id);
  return { templates, jobs, slots, assetStore, generations, template, jobIds };
}

describe('BatchRunner', () => {
  it('runs at most 3 generations concurrently and emits updates', async () => {
    const ctx = setup();
    const running = new Set<string>();
    let maxConcurrent = 0;
    const svc = new FakeGenerationService({
      delayMs: 20,
      shouldFail: () => false,
    });
    const trackedSvc = {
      async generate(req: any) {
        const key = req.finalPrompt + Math.random();
        running.add(key);
        maxConcurrent = Math.max(maxConcurrent, running.size);
        try { return await svc.generate(req); }
        finally { running.delete(key); }
      },
    };
    const events: string[] = [];
    const runner = new BatchRunner({
      generations: ctx.generations, jobs: ctx.jobs, templates: ctx.templates,
      slots: ctx.slots, assetStore: ctx.assetStore,
      generationService: trackedSvc as any,
      maxConcurrent: 3,
      model: 'test-model',
      emit: (e) => events.push(`${e.status}:${e.jobId}`),
    });

    await runner.runMany(ctx.jobIds);
    expect(events.filter(e => e.startsWith('running:')).length).toBe(5);
    expect(events.filter(e => e.startsWith('succeeded:')).length).toBe(5);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('marks generation failed and emits failure event when service throws', async () => {
    const ctx = setup();
    const svc = new FakeGenerationService({ shouldFail: () => true });
    const events: string[] = [];
    const runner = new BatchRunner({
      generations: ctx.generations, jobs: ctx.jobs, templates: ctx.templates,
      slots: ctx.slots, assetStore: ctx.assetStore,
      generationService: svc, maxConcurrent: 2, model: 'm',
      emit: (e) => events.push(`${e.status}:${e.errorMessage ?? ''}`),
    });
    await runner.runMany([ctx.jobIds[0]!]);
    expect(events.some(e => e.startsWith('failed:'))).toBe(true);
    const [gen] = ctx.generations.listByJob(ctx.jobIds[0]!);
    expect(gen!.status).toBe('failed');
  });
});
