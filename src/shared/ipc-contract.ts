import type {
  Template, Job, Asset, ImageSlot, Generation, SlotOwnerKind, UUID,
} from './types/domain';

export interface IpcContract {
  'settings:getApiKeyPresence': { req: void; res: { present: boolean } };
  'settings:setApiKey':         { req: { apiKey: string }; res: void };
  'settings:clearApiKey':       { req: void; res: void };

  'template:list':   { req: void; res: Template[] };
  'template:get':    { req: { id: UUID }; res: Template | null };
  'template:create': { req: { name: string }; res: Template };
  'template:update': { req: { id: UUID; patch: Partial<Pick<Template, 'name' | 'sharedPrompt'>> }; res: Template };
  'template:delete': { req: { id: UUID }; res: void };

  'job:listByTemplate': { req: { templateId: UUID }; res: Job[] };
  'job:get':    { req: { id: UUID }; res: Job | null };
  'job:create': { req: { templateId: UUID; name: string }; res: Job };
  'job:update': { req: { id: UUID; patch: Partial<Pick<Job, 'name' | 'prompt'>> }; res: Job };
  'job:delete': { req: { id: UUID }; res: void };

  'slot:listByOwner': {
    req: { ownerKind: SlotOwnerKind; ownerId: UUID };
    res: Array<ImageSlot & { asset: Asset }>;
  };
  'slot:create': {
    req: {
      ownerKind: SlotOwnerKind; ownerId: UUID;
      variableName: string; description: string;
      imageBytes: ArrayBuffer;
      originalFilename: string; mimeType: string;
    };
    res: ImageSlot & { asset: Asset };
  };
  'slot:update': {
    req: { id: UUID; patch: Partial<Pick<ImageSlot, 'variableName' | 'description' | 'position'>> };
    res: ImageSlot;
  };
  'slot:delete': { req: { id: UUID }; res: void };

  'prompt:compose': {
    req: { jobId: UUID };
    res: {
      finalPrompt: string;
      imageRefs: Array<{ variableName: string; description: string; assetId: UUID; originalFilename: string | null }>;
      warnings: string[];
    };
  };

  'generation:runMany': { req: { jobIds: UUID[] }; res: { batchId: string } };
  'generation:listByJob': { req: { jobId: UUID }; res: Generation[] };
  'generation:export': { req: { generationId: UUID }; res: { savedPath: string } | { cancelled: true } };

  'asset:getDataUrl': { req: { assetId: UUID }; res: { dataUrl: string } };
}

export interface IpcEvents {
  'generation:update': {
    generationId: UUID; jobId: UUID;
    status: 'running' | 'succeeded' | 'failed';
    resultAssetId?: UUID; errorMessage?: string;
  };
}
