import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { TemplateRepo } from './template-repo';
import { JobRepo } from './job-repo';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  const templates = new TemplateRepo(db);
  const jobs = new JobRepo(db);
  const template = templates.create('T');
  return { db, jobs, template, templates };
}

describe('JobRepo', () => {
  it('creates a job under a template', () => {
    const { jobs, template } = setup();
    const j = jobs.create({ templateId: template.id, name: 'J1' });
    expect(j.templateId).toBe(template.id);
    expect(j.prompt).toBe('');
  });

  it('lists jobs of a template newest first', async () => {
    const { jobs, template } = setup();
    jobs.create({ templateId: template.id, name: 'A' });
    await new Promise(r => setTimeout(r, 2));
    jobs.create({ templateId: template.id, name: 'B' });
    expect(jobs.listByTemplate(template.id).map(j => j.name)).toEqual(['B', 'A']);
  });

  it('updates name and prompt', () => {
    const { jobs, template } = setup();
    const j = jobs.create({ templateId: template.id, name: 'A' });
    const u = jobs.update(j.id, { name: 'B', prompt: 'hello' });
    expect(u.name).toBe('B');
    expect(u.prompt).toBe('hello');
  });

  it('cascades delete when template is deleted', () => {
    const { jobs, template, templates } = setup();
    jobs.create({ templateId: template.id, name: 'A' });
    templates.delete(template.id);
    expect(jobs.listByTemplate(template.id)).toEqual([]);
  });
});
