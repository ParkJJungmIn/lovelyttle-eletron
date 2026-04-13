import type { GenerationRequest, GenerationOutcome, IGenerationService } from './IGenerationService';

export class FakeGenerationService implements IGenerationService {
  constructor(
    private opts: {
      delayMs?: number;
      shouldFail?: (req: GenerationRequest) => boolean;
      outputBytes?: Buffer;
    } = {},
  ) {}

  async generate(req: GenerationRequest): Promise<GenerationOutcome> {
    if (this.opts.delayMs) await new Promise(r => setTimeout(r, this.opts.delayMs));
    if (this.opts.shouldFail?.(req)) throw new Error('fake failure');
    return {
      bytes: this.opts.outputBytes ?? Buffer.from('fake-image-bytes'),
      mimeType: 'image/png',
    };
  }
}
