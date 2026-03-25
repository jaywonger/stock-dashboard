import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNewsStore } from "../store/newsStore";
import { useSettingsStore } from "../store/settingsStore";

interface NewsResponse {
  articles: ReturnType<typeof useNewsStore.getState>["articles"];
  summary: ReturnType<typeof useNewsStore.getState>["summary"];
  activeSources: string[];
}

export const useNews = (ticker?: string) => {
  const interval = useSettingsStore((state) => state.refreshIntervals.news);
  const setNews = useNewsStore((state) => state.setNews);
  const jitterMs = useMemo(() => Math.floor(Math.random() * 15_000), []);
  return useQuery({
    queryKey: ["news", ticker],
    queryFn: async () => {
      const url = ticker ? `/api/news?ticker=${encodeURIComponent(ticker)}` : "/api/news";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error("News request failed");
      const payload = (await response.json()) as NewsResponse;
      setNews(payload.articles, payload.summary, payload.activeSources);
      return payload;
    },
    refetchInterval: (query) => {
      const data = query.state.data as NewsResponse | undefined;
      // Retry faster when provider calls temporarily return no articles.
      if (!data || data.articles.length === 0) return 10_000;
      return Math.max(60_000, interval + jitterMs);
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1
  });
};
