import { create } from "zustand";
import type { PriceAlert, Quote } from "../types";

interface MarketState {
  selectedTicker: string;
  compareTicker: string | null;
  quotes: Record<string, { data: Quote; updatedAt: number }>;
  activeWatchlistId: number | null;
  watchlistName: string;
  alerts: PriceAlert[];
  staleThresholdMs: number;
}

interface MarketActions {
  setSelectedTicker: (ticker: string) => void;
  setCompareTicker: (ticker: string | null) => void;
  upsertQuote: (quote: Quote) => void;
  setActiveWatchlistId: (id: number | null) => void;
  setWatchlistName: (name: string) => void;
  setAlerts: (alerts: PriceAlert[]) => void;
}

export const DEFAULT_TICKERS = ["SPY", "AAPL", "MSFT", "TSLA", "NVDA"];

export const useMarketStore = create<MarketState & MarketActions>((set) => ({
  selectedTicker: "SPY",
  compareTicker: null,
  activeWatchlistId: null,
  watchlistName: "Default",
  quotes: {},
  alerts: [],
  staleThresholdMs: 5 * 60_000,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker.toUpperCase() }),
  setCompareTicker: (ticker) => set({ compareTicker: ticker ? ticker.toUpperCase() : null }),
  setActiveWatchlistId: (id) => set({ activeWatchlistId: id }),
  upsertQuote: (quote) =>
    set((state) => ({
      quotes: {
        ...state.quotes,
        [quote.symbol]: { data: quote, updatedAt: Date.now() }
      }
    })),
  setWatchlistName: (name) => set({ watchlistName: name }),
  setAlerts: (alerts) => set({ alerts })
}));
