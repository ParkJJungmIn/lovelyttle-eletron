import { contextBridge, ipcRenderer } from 'electron';
import type { IpcContract, IpcEvents } from '@shared/ipc-contract';

const api = {
  invoke: <C extends keyof IpcContract>(channel: C, req: IpcContract[C]['req']): Promise<IpcContract[C]['res']> =>
    ipcRenderer.invoke(channel, req),
  on: <E extends keyof IpcEvents>(event: E, handler: (payload: IpcEvents[E]) => void) => {
    const wrapped = (_: unknown, payload: IpcEvents[E]) => handler(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.off(event, wrapped);
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window { api: typeof api }
}

export type Api = typeof api;
