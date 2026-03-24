import { create } from "zustand";
import type { NewsArticle, SentimentSummary, SentimentLabel } from "../types";

interface NewsState {
  articles: NewsArticle[];
  summary: SentimentSummary;
  sentimentFilter: "all" | SentimentLabel;
  tickerFilter: string | null;
  lastUpdatedAt: string | null;
  activeSources: string[];
}

interface NewsActions {
  setNews: (articles: NewsArticle[], summary: SentimentSummary, activeSources: string[]) => void;
  setSentimentFilter: (filter: "all" | SentimentLabel) => void;
  setTickerFilter: (ticker: string | null) => void;
}

const emptySummary: SentimentSummary = {
  overallScore: 50,
  topBullish: [],
  topBearish: [],
  trend: []
};

export const useNewsStore = create<NewsState & NewsActions>((set) => ({
  articles: [],
  summary: emptySummary,
  sentimentFilter: "all",
  tickerFilter: null,
  lastUpdatedAt: null,
  activeSources: [],
  setNews: (articles, summary, activeSources) =>
    set({
      articles,
      summary,
      activeSources,
      lastUpdatedAt: new Date().toISOString()
    }),
  setSentimentFilter: (filter) => set({ sentimentFilter: filter }),
  setTickerFilter: (ticker) => set({ tickerFilter: ticker ? ticker.toUpperCase() : null })
}));
