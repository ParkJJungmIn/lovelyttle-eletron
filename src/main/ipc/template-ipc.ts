import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerTemplateIpc(ctx: AppContext): void {
  handle('template:list', () => ctx.templates.list());
  handle('template:get', ({ id }) => ctx.templates.get(id));
  handle('template:create', ({ name }) => ctx.templates.create(name));
  handle('template:update', ({ id, patch }) => ctx.templates.update(id, patch));
  handle('template:delete', ({ id }) => { ctx.templates.delete(id); });
}
