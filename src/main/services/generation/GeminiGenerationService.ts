import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerationRequest, GenerationOutcome, IGenerationService } from './IGenerationService';

export class GeminiGenerationService implements IGenerationService {
  constructor(private getApiKey: () => string | null) {}

  async generate(req: GenerationRequest): Promise<GenerationOutcome> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('API key not set. Open Settings to add one.');

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: req.model });

    const parts: any[] = [];
    for (const img of req.images) {
      const label = `{${img.variableName}}`;
      const text = img.description ? `${label} (${img.description})` : label;
      parts.push({ text });
      parts.push({ inlineData: { data: img.bytes.toString('base64'), mimeType: img.mimeType } });
    }
    parts.push({ text: req.finalPrompt });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] as any },
    } as any);

    const candidates = (response.response as any).candidates ?? [];
    for (const c of candidates) {
      const cp = c.content?.parts ?? [];
      for (const p of cp) {
        if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('image/')) {
          return {
            bytes: Buffer.from(p.inlineData.data, 'base64'),
            mimeType: p.inlineData.mimeType,
          };
        }
      }
    }
    throw new Error('No image returned from Gemini.');
  }
}
