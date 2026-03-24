import { useQuery } from "@tanstack/react-query";
import type { Timeframe } from "../types";
import { HttpStockDataService } from "../services/stockDataService";

const stockService = new HttpStockDataService("/api");

const rangeByTimeframe: Record<Timeframe, number> = {
  "1m": 2,
  "5m": 5,
  "15m": 10,
  "1h": 30,
  "4h": 90,
  "1D": 365,
  "1W": 900,
  "1M": 1800
};

export const useOHLCV = (ticker: string, timeframe: Timeframe) =>
  useQuery({
    queryKey: ["ohlcv", ticker, timeframe],
    queryFn: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - rangeByTimeframe[timeframe]);
      return stockService.getOHLCV(ticker, timeframe, from, to);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: Boolean(ticker)
  });
