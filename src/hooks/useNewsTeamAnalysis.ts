import { useQuery } from "@tanstack/react-query";
import type { NewsTeamAnalysisReport, Timeframe } from "../types";

export const useNewsTeamAnalysis = (ticker: string, timeframe: Timeframe, analysisDate: string, rounds: number) =>
  useQuery({
    queryKey: ["news-team-analysis", ticker, timeframe, analysisDate, rounds],
    queryFn: async () => {
      const params = new URLSearchParams({
        ticker,
        timeframe,
        analysisDate,
        rounds: String(rounds)
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(`/api/analysis/news-team?${params.toString()}`, {
        signal: controller.signal
      }).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error("News team analysis request failed");
      return (await response.json()) as NewsTeamAnalysisReport;
    },
    enabled: Boolean(ticker),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1
  });

