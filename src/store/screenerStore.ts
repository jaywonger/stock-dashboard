import { create } from "zustand";
import type { ScreenerConfig, ScreenerRow, SortDirection } from "../types";

interface ScreenerState {
  config: ScreenerConfig;
  results: ScreenerRow[];
  sortBy: keyof ScreenerRow;
  sortDirection: SortDirection;
  refreshInterval: number;
  visibleColumns: Array<keyof ScreenerRow>;
}

interface ScreenerActions {
  setConfig: (config: ScreenerConfig) => void;
  setResults: (results: ScreenerRow[]) => void;
  toggleColumn: (column: keyof ScreenerRow) => void;
  setSort: (column: keyof ScreenerRow) => void;
  setRefreshInterval: (interval: number) => void;
}

export const defaultScreenerConfig: ScreenerConfig = {
  basic: {
    exchange: "All",
    marketCapRange: { min: null, max: null },
    sectors: [],
    priceMin: null,
    priceMax: null,
    minAverageVolume30d: null
  },
  technicalConditions: [],
  technicalJoin: "AND"
};

const defaultColumns: Array<keyof ScreenerRow> = [
  "symbol",
  "company",
  "price",
  "changePercent",
  "volume",
  "relativeVolume",
  "rsi",
  "macd",
  "activeSignals",
  "sector",
  "marketCap",
  "sparkline"
];

export const useScreenerStore = create<ScreenerState & ScreenerActions>((set, get) => ({
  config: defaultScreenerConfig,
  results: [],
  sortBy: "changePercent",
  sortDirection: "desc",
  refreshInterval: 60_000,
  visibleColumns: defaultColumns,
  setConfig: (config) => set({ config }),
  setResults: (results) => set({ results }),
  toggleColumn: (column) =>
    set((state) => ({
      visibleColumns: state.visibleColumns.includes(column)
        ? state.visibleColumns.filter((item) => item !== column)
        : [...state.visibleColumns, column]
    })),
  setSort: (column) => {
    const current = get();
    const nextDirection: SortDirection =
      current.sortBy === column ? (current.sortDirection === "asc" ? "desc" : "asc") : "desc";
    set({ sortBy: column, sortDirection: nextDirection });
  },
  setRefreshInterval: (interval) => set({ refreshInterval: interval })
}));
