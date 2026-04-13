import { create } from 'zustand';
import { ipc } from '@/ipc-client';

interface SettingsState {
  apiKeyPresent: boolean;
  modalOpen: boolean;
  open: () => void;
  close: () => void;
  refresh: () => Promise<void>;
  save: (apiKey: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKeyPresent: false,
  modalOpen: false,
  open: () => set({ modalOpen: true }),
  close: () => set({ modalOpen: false }),
  refresh: async () => {
    const { present } = await ipc.settings.getApiKeyPresence();
    set({ apiKeyPresent: present });
  },
  save: async (apiKey) => {
    await ipc.settings.setApiKey(apiKey);
    set({ apiKeyPresent: true });
  },
  clear: async () => {
    await ipc.settings.clearApiKey();
    set({ apiKeyPresent: false });
  },
}));
