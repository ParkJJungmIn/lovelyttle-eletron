import type { IpcContract, IpcEvents } from '@shared/ipc-contract';

type Api = {
  invoke: <C extends keyof IpcContract>(channel: C, req: IpcContract[C]['req']) => Promise<IpcContract[C]['res']>;
  on: <E extends keyof IpcEvents>(event: E, handler: (payload: IpcEvents[E]) => void) => () => void;
};

const api = (window as unknown as { api: Api }).api;

export const ipc = {
  settings: {
    getApiKeyPresence: () => api.invoke('settings:getApiKeyPresence', undefined),
    setApiKey: (apiKey: string) => api.invoke('settings:setApiKey', { apiKey }),
    clearApiKey: () => api.invoke('settings:clearApiKey', undefined),
  },
  template: {
    list:   () => api.invoke('template:list', undefined),
    get:    (id: string) => api.invoke('template:get', { id }),
    create: (name: string) => api.invoke('template:create', { name }),
    update: (id: string, patch: IpcContract['template:update']['req']['patch']) => api.invoke('template:update', { id, patch }),
    delete: (id: string) => api.invoke('template:delete', { id }),
  },
  job: {
    listByTemplate: (templateId: string) => api.invoke('job:listByTemplate', { templateId }),
    get:    (id: string) => api.invoke('job:get', { id }),
    create: (templateId: string, name: string) => api.invoke('job:create', { templateId, name }),
    update: (id: string, patch: IpcContract['job:update']['req']['patch']) => api.invoke('job:update', { id, patch }),
    delete: (id: string) => api.invoke('job:delete', { id }),
  },
  slot: {
    listByOwner: (ownerKind: 'template' | 'job', ownerId: string) =>
      api.invoke('slot:listByOwner', { ownerKind, ownerId }),
    create: (req: IpcContract['slot:create']['req']) => api.invoke('slot:create', req),
    update: (id: string, patch: IpcContract['slot:update']['req']['patch']) => api.invoke('slot:update', { id, patch }),
    delete: (id: string) => api.invoke('slot:delete', { id }),
  },
  prompt: {
    compose: (jobId: string) => api.invoke('prompt:compose', { jobId }),
  },
  generation: {
    runMany: (jobIds: string[]) => api.invoke('generation:runMany', { jobIds }),
    listByJob: (jobId: string) => api.invoke('generation:listByJob', { jobId }),
    export: (generationId: string) => api.invoke('generation:export', { generationId }),
    onUpdate: (fn: (p: IpcEvents['generation:update']) => void) => api.on('generation:update', fn),
  },
  asset: {
    getDataUrl: (assetId: string) => api.invoke('asset:getDataUrl', { assetId }),
  },
};
