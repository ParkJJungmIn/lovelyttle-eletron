import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerJobIpc(ctx: AppContext): void {
  handle('job:listByTemplate', ({ templateId }) => ctx.jobs.listByTemplate(templateId));
  handle('job:get', ({ id }) => ctx.jobs.getById(id));
  handle('job:create', ({ templateId, name }) => ctx.jobs.create({ templateId, name }));
  handle('job:update', ({ id, patch }) => ctx.jobs.update(id, patch));
  handle('job:delete', ({ id }) => { ctx.jobs.delete(id); });
}
