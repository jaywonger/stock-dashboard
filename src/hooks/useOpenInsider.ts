import { useQuery } from "@tanstack/react-query";
import type { OpenInsiderTickerSummary } from "../types";

export const useOpenInsider = (ticker: string) =>
  useQuery({
    queryKey: ["openinsider", ticker],
    queryFn: async () => {
      const response = await fetch(`/api/analysis/openinsider?ticker=${encodeURIComponent(ticker)}`);
      if (!response.ok) throw new Error("OpenInsider request failed");
      return (await response.json()) as OpenInsiderTickerSummary;
    },
    enabled: Boolean(ticker),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1
  });
