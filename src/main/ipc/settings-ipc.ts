import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerSettingsIpc(ctx: AppContext): void {
  handle('settings:getApiKeyPresence', () => ({ present: ctx.secureStorage.hasApiKey() }));
  handle('settings:setApiKey', ({ apiKey }) => { ctx.secureStorage.setApiKey(apiKey); });
  handle('settings:clearApiKey', () => { ctx.secureStorage.clearApiKey(); });
}
