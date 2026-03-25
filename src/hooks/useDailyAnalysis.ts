import { useQuery } from "@tanstack/react-query";
import type { DailyDecisionDashboard, Timeframe } from "../types";

export const useDailyAnalysis = (ticker: string, timeframe: Timeframe) =>
  useQuery({
    queryKey: ["daily-analysis", ticker, timeframe],
    queryFn: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);
      const response = await fetch(
        `/api/analysis/daily?ticker=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(timeframe)}`,
        { signal: controller.signal }
      ).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error("Daily analysis request failed");
      return (await response.json()) as DailyDecisionDashboard;
    },
    enabled: Boolean(ticker),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 8_000)
  });
