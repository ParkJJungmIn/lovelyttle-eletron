import type { DB } from './db/connection';
import { TemplateRepo } from './db/repositories/template-repo';
import { JobRepo } from './db/repositories/job-repo';
import { SlotRepo } from './db/repositories/slot-repo';
import { AssetRepo } from './db/repositories/asset-repo';
import { GenerationRepo } from './db/repositories/generation-repo';
import { SecureStorage } from './services/secure-storage';
import { AssetStore } from './services/asset-store';
import { GeminiGenerationService } from './services/generation/GeminiGenerationService';
import type { IGenerationService } from './services/generation/IGenerationService';
import { BatchRunner } from './services/batch-runner';
import { GEMINI_MODEL } from './services/generation/constants';
import type { BatchUpdateEvent } from './services/batch-runner';

export interface AppContext {
  templates: TemplateRepo;
  jobs: JobRepo;
  slots: SlotRepo;
  assets: AssetRepo;
  generations: GenerationRepo;
  assetStore: AssetStore;
  secureStorage: SecureStorage;
  generationService: IGenerationService;
  makeBatchRunner: (emit: (e: BatchUpdateEvent) => void) => BatchRunner;
  userDataDir: string;
}

export function buildAppContext(db: DB, userDataDir: string): AppContext {
  const templates = new TemplateRepo(db);
  const jobs = new JobRepo(db);
  const slots = new SlotRepo(db);
  const assets = new AssetRepo(db);
  const generations = new GenerationRepo(db);
  const assetStore = new AssetStore(assets, userDataDir);
  const secureStorage = new SecureStorage(userDataDir);
  const generationService = new GeminiGenerationService(() => secureStorage.getApiKey());

  const makeBatchRunner = (emit: (e: BatchUpdateEvent) => void) =>
    new BatchRunner({
      templates, jobs, slots, generations, assetStore,
      generationService, maxConcurrent: 3, model: GEMINI_MODEL, emit,
    });

  return { templates, jobs, slots, assets, generations, assetStore, secureStorage, generationService, makeBatchRunner, userDataDir };
}
