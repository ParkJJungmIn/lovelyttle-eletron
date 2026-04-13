import { create } from 'zustand';
import type { Job } from '@shared/types/domain';
import type { IpcEvents } from '@shared/ipc-contract';
import { ipc } from '@/ipc-client';

export type JobRuntimeStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed';

interface JobState {
  jobsByTemplateId: Record<string, Job[]>;
  selectedId: string | null;
  checkedIds: Set<string>;
  statusByJobId: Record<string, JobRuntimeStatus>;

  loadByTemplate: (templateId: string) => Promise<void>;
  select: (id: string | null) => void;
  toggleCheck: (id: string) => void;
  clearChecks: () => void;
  create: (templateId: string, name: string) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Job, 'name' | 'prompt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  runSelected: () => Promise<void>;
  applyGenerationEvent: (ev: IpcEvents['generation:update']) => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobsByTemplateId: {},
  selectedId: null,
  checkedIds: new Set(),
  statusByJobId: {},

  loadByTemplate: async (templateId) => {
    const jobs = await ipc.job.listByTemplate(templateId);
    set(state => ({
      jobsByTemplateId: { ...state.jobsByTemplateId, [templateId]: jobs },
      selectedId: state.selectedId && jobs.some(j => j.id === state.selectedId) ? state.selectedId : jobs[0]?.id ?? null,
    }));
  },
  select: (id) => set({ selectedId: id }),
  toggleCheck: (id) => set(state => {
    const next = new Set(state.checkedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { checkedIds: next };
  }),
  clearChecks: () => set({ checkedIds: new Set() }),
  create: async (templateId, name) => {
    const j = await ipc.job.create(templateId, name);
    set(state => ({
      jobsByTemplateId: { ...state.jobsByTemplateId, [templateId]: [j, ...(state.jobsByTemplateId[templateId] ?? [])] },
      selectedId: j.id,
    }));
  },
  update: async (id, patch) => {
    const u = await ipc.job.update(id, patch);
    set(state => {
      const list = state.jobsByTemplateId[u.templateId] ?? [];
      return { jobsByTemplateId: { ...state.jobsByTemplateId, [u.templateId]: list.map(j => j.id === id ? u : j) } };
    });
  },
  remove: async (id) => {
    const job = Object.values(get().jobsByTemplateId).flat().find(j => j.id === id);
    await ipc.job.delete(id);
    if (!job) return;
    set(state => ({
      jobsByTemplateId: {
        ...state.jobsByTemplateId,
        [job.templateId]: (state.jobsByTemplateId[job.templateId] ?? []).filter(j => j.id !== id),
      },
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },
  runSelected: async () => {
    const ids = [...get().checkedIds];
    if (ids.length === 0) return;
    const statusByJobId = { ...get().statusByJobId };
    for (const id of ids) statusByJobId[id] = 'pending';
    set({ statusByJobId });
    await ipc.generation.runMany(ids);
  },
  applyGenerationEvent: (ev) => {
    set(state => ({ statusByJobId: { ...state.statusByJobId, [ev.jobId]: ev.status } }));
  },
}));
