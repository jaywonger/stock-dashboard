import { useQuery } from "@tanstack/react-query";
import { HttpStockDataService } from "../services/stockDataService";
import { useMarketStore } from "../store/marketStore";
import { useSettingsStore } from "../store/settingsStore";

const stockService = new HttpStockDataService("/api");

export const useQuote = (ticker: string) => {
  const upsertQuote = useMarketStore((state) => state.upsertQuote);
  const interval = useSettingsStore((state) => state.refreshIntervals.marketData);

  return useQuery({
    queryKey: ["quote", ticker],
    queryFn: async () => {
      const quote = await stockService.getQuote(ticker);
      upsertQuote(quote);
      return quote;
    },
    refetchInterval: interval,
    staleTime: Math.max(5_000, Math.floor(interval * 0.8)),
    gcTime: Math.max(30_000, interval * 3),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: Boolean(ticker)
  });
};
