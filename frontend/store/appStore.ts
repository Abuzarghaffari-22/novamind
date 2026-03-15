import { create } from "zustand";
import type { ActiveTab, AppSettings } from "@/types";

interface AppStore {
  activeTab:   ActiveTab;
  setActiveTab:(tab: ActiveTab) => void;

  sidebarOpen: boolean;
  setSidebarOpen:(open: boolean) => void;

  settings:    AppSettings;
  setSettings: (partial: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab:    "chat",
  setActiveTab: (activeTab) => set({ activeTab }),

  sidebarOpen:    true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  settings: {
    useRag:         true,
    useAgent:       false,
    temperature:    0.7,
    streamResponse: true,
  },
  setSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),
}));
