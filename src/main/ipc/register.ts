import { ipcMain, BrowserWindow } from 'electron';
import type { IpcContract, IpcEvents } from '@shared/ipc-contract';
import type { AppContext } from '../app-context';
import { registerSettingsIpc } from './settings-ipc';
import { registerTemplateIpc } from './template-ipc';
import { registerJobIpc } from './job-ipc';
import { registerSlotIpc } from './slot-ipc';
import { registerPromptIpc } from './prompt-ipc';
import { registerGenerationIpc } from './generation-ipc';
import { registerAssetIpc } from './asset-ipc';

export function handle<C extends keyof IpcContract>(
  channel: C,
  fn: (req: IpcContract[C]['req']) => Promise<IpcContract[C]['res']> | IpcContract[C]['res'],
): void {
  ipcMain.handle(channel, async (_evt, req) => fn(req));
}

export function broadcast<E extends keyof IpcEvents>(event: E, payload: IpcEvents[E]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(event, payload);
}

export function registerIpc(ctx: AppContext): void {
  registerSettingsIpc(ctx);
  registerTemplateIpc(ctx);
  registerJobIpc(ctx);
  registerSlotIpc(ctx);
  registerPromptIpc(ctx);
  registerGenerationIpc(ctx);
  registerAssetIpc(ctx);
}
