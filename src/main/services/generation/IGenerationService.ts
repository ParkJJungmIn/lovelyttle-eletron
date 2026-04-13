export interface GenerationImageInput {
  variableName: string;
  description: string;
  bytes: Buffer;
  mimeType: string;
}

export interface GenerationRequest {
  finalPrompt: string;
  images: GenerationImageInput[];
  model: string;
}

export interface GenerationOutcome {
  bytes: Buffer;
  mimeType: string;
}

export interface IGenerationService {
  generate(req: GenerationRequest): Promise<GenerationOutcome>;
}
