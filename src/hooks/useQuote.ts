import { useQuery } from "@tanstack/react-query";
import { HttpStockDataService } from "../services/stockDataService";
import { useSettingsStore } from "../store/settingsStore";

const stockService = new HttpStockDataService("/api");

interface UseQuoteOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export const useQuote = (ticker: string, options: UseQuoteOptions = {}) => {
  const interval = useSettingsStore((state) => state.refreshIntervals.marketData);
  const refetchInterval = options.intervalMs ?? interval;

  return useQuery({
    queryKey: ["quote", ticker],
    queryFn: () => stockService.getQuote(ticker),
    refetchInterval,
    staleTime: Math.max(5_000, Math.floor(refetchInterval * 0.8)),
    gcTime: Math.max(30_000, refetchInterval * 3),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: Boolean(ticker) && (options.enabled ?? true)
  });
};
