import { describe, it, expect } from 'vitest';
import { composePrompt } from './prompt-compose';
import type { ImageSlot } from './types/domain';

const slot = (overrides: Partial<ImageSlot>): ImageSlot => ({
  id: 'id',
  ownerKind: 'template',
  ownerId: 'owner',
  assetId: 'asset',
  variableName: 'imageA',
  description: '',
  position: 0,
  ...overrides,
});

describe('composePrompt', () => {
  it('joins template shared prompt and job prompt with a blank line', () => {
    const r = composePrompt({
      template: { sharedPrompt: 'Style: watercolor.', slots: [] },
      job: { prompt: 'Combine the images.', slots: [] },
    });
    expect(r.finalPrompt).toBe('Style: watercolor.\n\nCombine the images.');
  });

  it('omits empty template prompt', () => {
    const r = composePrompt({
      template: { sharedPrompt: '', slots: [] },
      job: { prompt: 'Only job.', slots: [] },
    });
    expect(r.finalPrompt).toBe('Only job.');
  });

  it('orders image refs: template slots by position, then job slots by position', () => {
    const r = composePrompt({
      template: {
        sharedPrompt: '',
        slots: [
          slot({ variableName: 'style', ownerKind: 'template', position: 1 }),
          slot({ variableName: 'logo', ownerKind: 'template', position: 0, assetId: 'a-logo' }),
        ],
      },
      job: {
        prompt: '',
        slots: [
          slot({ variableName: 'person', ownerKind: 'job', position: 0, assetId: 'a-person' }),
        ],
      },
    });
    expect(r.imageRefs.map(i => i.variableName)).toEqual(['logo', 'style', 'person']);
  });

  it('job slot overrides template slot of the same variable name (appears at job position)', () => {
    const r = composePrompt({
      template: {
        sharedPrompt: '',
        slots: [
          slot({ variableName: 'imageA', ownerKind: 'template', position: 0, assetId: 'tpl' }),
          slot({ variableName: 'extra', ownerKind: 'template', position: 1, assetId: 'ex' }),
        ],
      },
      job: {
        prompt: '',
        slots: [
          slot({ variableName: 'imageA', ownerKind: 'job', position: 0, assetId: 'job-a' }),
        ],
      },
    });
    const names = r.imageRefs.map(i => i.variableName);
    expect(names).toEqual(['extra', 'imageA']);
    expect(r.imageRefs.find(i => i.variableName === 'imageA')?.assetId).toBe('job-a');
  });

  it('warns on referenced-but-undefined variables', () => {
    const r = composePrompt({
      template: { sharedPrompt: 'Use {missing}.', slots: [] },
      job: { prompt: '', slots: [] },
    });
    expect(r.warnings.some(w => w.includes('missing'))).toBe(true);
  });

  it('warns on defined-but-unreferenced slots', () => {
    const r = composePrompt({
      template: {
        sharedPrompt: 'no references here',
        slots: [slot({ variableName: 'unused' })],
      },
      job: { prompt: '', slots: [] },
    });
    expect(r.warnings.some(w => w.includes('unused'))).toBe(true);
  });

  it('does not warn when all variables are matched', () => {
    const r = composePrompt({
      template: { sharedPrompt: 'Start', slots: [slot({ variableName: 'imageA' })] },
      job: { prompt: 'refer {imageA}', slots: [] },
    });
    expect(r.warnings).toEqual([]);
  });
});
