import { create } from 'zustand';
import type { Template } from '@shared/types/domain';
import { ipc } from '@/ipc-client';

interface TemplateState {
  templates: Template[];
  selectedId: string | null;
  load: () => Promise<void>;
  select: (id: string | null) => void;
  create: (name: string) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Template, 'name' | 'sharedPrompt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  selectedId: null,
  load: async () => {
    const templates = await ipc.template.list();
    set(state => ({
      templates,
      selectedId: state.selectedId && templates.some(t => t.id === state.selectedId)
        ? state.selectedId
        : templates[0]?.id ?? null,
    }));
  },
  select: (id) => set({ selectedId: id }),
  create: async (name) => {
    const t = await ipc.template.create(name);
    set({ templates: [t, ...get().templates], selectedId: t.id });
  },
  update: async (id, patch) => {
    const u = await ipc.template.update(id, patch);
    set({ templates: get().templates.map(t => t.id === id ? u : t) });
  },
  remove: async (id) => {
    await ipc.template.delete(id);
    const remaining = get().templates.filter(t => t.id !== id);
    set({ templates: remaining, selectedId: remaining[0]?.id ?? null });
  },
}));
