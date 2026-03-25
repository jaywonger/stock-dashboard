import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SettingsState, StockProviderId } from "../types";

interface SettingsActions {
  setApiKey: (key: keyof SettingsState["keys"], value: string) => void;
  setProviderPriority: (priority: StockProviderId[]) => void;
  setRefreshInterval: (key: keyof SettingsState["refreshIntervals"], value: number) => void;
  setNotificationEnabled: (enabled: boolean) => void;
  setAiApiKey: (key: keyof SettingsState["keys"], value: string) => void;
}

const defaultSettings: SettingsState = {
  providerPriority: [
    { id: "yfinance", enabled: true },
    { id: "polygon", enabled: true },
    { id: "finnhub", enabled: true },
    { id: "alphaVantage", enabled: true },
    { id: "yahoo", enabled: true },
    { id: "mock", enabled: true }
  ],
  refreshIntervals: {
    marketData: 60_000,
    news: 60_000,
    screener: 60_000
  },
  indicatorDefaults: {
    rsiPeriod: 14,
    smaPeriods: [20, 50, 200],
    emaPeriods: [20, 50],
    bollingerPeriod: 20,
    bollingerStdDev: 2,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9
  },
  notificationEnabled: true,
  keys: {
    polygonApiKey: "",
    alphaVantageApiKey: "",
    finnhubApiKey: "",
    newsApiKey: "",
    benzingaApiKey: "",
    rssFeedUrls: [],
    // AI Agent keys
    litellmModel: "",
    litellmApiKey: "",
    litellmBaseUrl: "",
    geminiApiKey: "",
    claudeApiKey: "",
    openaiApiKey: "",
    openaiBaseUrl: "",
    openaiModel: "",
    openrouterApiKey: "",
    openrouterBaseUrl: "",
    openrouterModel: ""
  }
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setApiKey: (key, value) =>
        set((state) => ({
          keys: {
            ...state.keys,
            [key]: key === "rssFeedUrls" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value
          }
        })),
      setProviderPriority: (priority) =>
        set({
          providerPriority: priority.map((id) => ({ id, enabled: true }))
        }),
      setRefreshInterval: (key, value) =>
        set((state) => ({
          refreshIntervals: {
            ...state.refreshIntervals,
            [key]: value
          }
        })),
      setNotificationEnabled: (enabled) => set({ notificationEnabled: enabled }),
      setAiApiKey: (key, value) =>
        set((state) => ({
          keys: {
            ...state.keys,
            [key]: value
          }
        }))
    }),
    {
      name: "stocks-dashboard-settings"
    }
  )
);
