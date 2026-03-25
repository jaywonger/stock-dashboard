import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Quote } from "../types";
import { useSettingsStore } from "../store/settingsStore";

interface UseQuotesBatchOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export const useQuotesBatch = (symbols: string[], options: UseQuotesBatchOptions = {}) => {
  const refreshInterval = useSettingsStore((state) => state.refreshIntervals.marketData);
  const interval = options.intervalMs ?? refreshInterval;
  const normalized = useMemo(
    () =>
      Array.from(
        new Set(
          symbols
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean)
        )
      ).sort(),
    [symbols]
  );

  return useQuery({
    queryKey: ["quotes-batch", normalized.join(",")],
    queryFn: async () => {
      if (normalized.length === 0) return {} as Record<string, Quote>;
      const response = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(normalized.join(","))}`);
      if (!response.ok) throw new Error("Batch quote request failed");
      const rows = (await response.json()) as Quote[];
      return Object.fromEntries(rows.map((quote) => [quote.symbol.toUpperCase(), quote])) as Record<string, Quote>;
    },
    enabled: normalized.length > 0 && (options.enabled ?? true),
    refetchInterval: interval,
    staleTime: Math.max(10_000, Math.floor(interval * 0.8)),
    gcTime: Math.max(60_000, interval * 3),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
};
