import type { ImageSlot } from './types/domain';

export interface ComposeInput {
  template: { sharedPrompt: string; slots: ImageSlot[] };
  job:      { prompt: string;       slots: ImageSlot[] };
}

export interface ComposedImageRef {
  variableName: string;
  assetId: string;
  description: string;
}

export interface ComposeResult {
  finalPrompt: string;
  imageRefs: ComposedImageRef[];
  warnings: string[];
}

const VAR_RE = /\{(\w+)\}/g;

function extractReferences(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) names.add(m[1]!);
  return names;
}

export function composePrompt(input: ComposeInput): ComposeResult {
  const jobNames = new Set(input.job.slots.map(s => s.variableName));

  const templateOrdered = [...input.template.slots]
    .filter(s => !jobNames.has(s.variableName))
    .sort((a, b) => a.position - b.position);

  const jobOrdered = [...input.job.slots].sort((a, b) => a.position - b.position);

  const orderedSlots = [...templateOrdered, ...jobOrdered];

  const parts = [input.template.sharedPrompt.trim(), input.job.prompt.trim()].filter(Boolean);
  const finalPrompt = parts.join('\n\n');

  const referenced = extractReferences(finalPrompt);
  const defined = new Set(orderedSlots.map(s => s.variableName));

  const warnings: string[] = [];
  for (const name of referenced) {
    if (!defined.has(name)) warnings.push(`Variable {${name}} is referenced but not defined.`);
  }
  for (const name of defined) {
    if (!referenced.has(name)) warnings.push(`Image {${name}} is defined but not referenced in the prompt.`);
  }

  return {
    finalPrompt,
    imageRefs: orderedSlots.map(s => ({
      variableName: s.variableName,
      assetId: s.assetId,
      description: s.description,
    })),
    warnings,
  };
}
