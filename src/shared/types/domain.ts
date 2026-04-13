export type UUID = string;
export type UnixMs = number;

export interface Template {
  id: UUID;
  name: string;
  sharedPrompt: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface Job {
  id: UUID;
  templateId: UUID;
  name: string;
  prompt: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface Asset {
  id: UUID;
  contentHash: string;
  mimeType: string;
  byteSize: number;
  originalFilename: string | null;
  createdAt: UnixMs;
}

export type SlotOwnerKind = 'template' | 'job';

export interface ImageSlot {
  id: UUID;
  ownerKind: SlotOwnerKind;
  ownerId: UUID;
  assetId: UUID;
  variableName: string;
  description: string;
  position: number;
}

export type GenerationStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ImageRefSnapshot {
  variableName: string;
  assetId: UUID;
  description: string;
}

export interface Generation {
  id: UUID;
  jobId: UUID;
  status: GenerationStatus;
  finalPrompt: string;
  imageRefs: ImageRefSnapshot[];
  resultAssetId: UUID | null;
  errorMessage: string | null;
  model: string;
  startedAt: UnixMs;
  finishedAt: UnixMs | null;
}
