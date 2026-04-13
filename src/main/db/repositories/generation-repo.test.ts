import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { TemplateRepo } from './template-repo';
import { JobRepo } from './job-repo';
import { GenerationRepo } from './generation-repo';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  const template = new TemplateRepo(db).create('T');
  const job = new JobRepo(db).create({ templateId: template.id, name: 'J' });
  return { db, job, generations: new GenerationRepo(db) };
}

describe('GenerationRepo', () => {
  it('creates a pending generation', () => {
    const { job, generations } = setup();
    const g = generations.createPending({
      jobId: job.id, finalPrompt: 'hi', imageRefs: [], model: 'gemini',
    });
    expect(g.status).toBe('pending');
    expect(g.finalPrompt).toBe('hi');
  });

  it('marks running', () => {
    const { job, generations } = setup();
    const g = generations.createPending({ jobId: job.id, finalPrompt: 'p', imageRefs: [], model: 'm' });
    const r = generations.markRunning(g.id);
    expect(r.status).toBe('running');
  });

  it('marks succeeded with result asset id', () => {
    const { job, generations, db } = setup();
    db.prepare(`INSERT INTO assets (id, content_hash, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run('asset-1', 'h', 'image/png', 1, Date.now());
    const g = generations.createPending({ jobId: job.id, finalPrompt: 'p', imageRefs: [], model: 'm' });
    generations.markRunning(g.id);
    const r = generations.markSucceeded(g.id, 'asset-1');
    expect(r.status).toBe('succeeded');
    expect(r.resultAssetId).toBe('asset-1');
  });

  it('marks failed with message', () => {
    const { job, generations } = setup();
    const g = generations.createPending({ jobId: job.id, finalPrompt: 'p', imageRefs: [], model: 'm' });
    const r = generations.markFailed(g.id, 'boom');
    expect(r.status).toBe('failed');
    expect(r.errorMessage).toBe('boom');
  });

  it('lists generations for a job newest first', async () => {
    const { job, generations } = setup();
    generations.createPending({ jobId: job.id, finalPrompt: 'one', imageRefs: [], model: 'm' });
    await new Promise(r => setTimeout(r, 2));
    generations.createPending({ jobId: job.id, finalPrompt: 'two', imageRefs: [], model: 'm' });
    expect(generations.listByJob(job.id).map(g => g.finalPrompt)).toEqual(['two', 'one']);
  });
});
