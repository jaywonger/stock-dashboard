import { useQuery } from "@tanstack/react-query";
import type { WatchlistMetrics } from "../types";
import { useSettingsStore } from "../store/settingsStore";

interface WatchlistMetricsResponse {
  rows: WatchlistMetrics[];
}

export const useWatchlistMetrics = (symbols: string[]) => {
  const refreshInterval = useSettingsStore((state) => state.refreshIntervals.marketData);
  const normalized = symbols.map((s) => s.toUpperCase()).filter(Boolean);
  const metricsInterval = Math.max(120_000, refreshInterval * 2);

  return useQuery({
    queryKey: ["watchlist-metrics", [...normalized].sort().join(",")],
    queryFn: async () => {
      if (normalized.length === 0) return [] as WatchlistMetrics[];
      const response = await fetch("/api/screener/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: normalized })
      });
      if (!response.ok) throw new Error("Watchlist metrics request failed");
      const payload = (await response.json()) as WatchlistMetricsResponse;
      return payload.rows ?? [];
    },
    enabled: normalized.length > 0,
    refetchInterval: metricsInterval,
    staleTime: Math.max(10_000, Math.floor(metricsInterval * 0.8)),
    gcTime: Math.max(60_000, metricsInterval * 3),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
};
