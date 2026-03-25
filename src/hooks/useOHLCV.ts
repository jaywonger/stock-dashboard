import { useQuery } from "@tanstack/react-query";
import type { OHLCV, Timeframe } from "../types";
import { HttpStockDataService } from "../services/stockDataService";

const stockService = new HttpStockDataService("/api");

const chartRequestByTimeframe: Record<Timeframe, { requestTimeframe: Timeframe; days: number; bucketMinutes?: number }> = {
  "1m": { requestTimeframe: "1m", days: 2 },
  "5m": { requestTimeframe: "5m", days: 5 },
  "15m": { requestTimeframe: "15m", days: 10 },
  // Request 15m and aggregate to 1h for provider consistency (e.g., AlphaVantage).
  "1h": { requestTimeframe: "15m", days: 30, bucketMinutes: 60 },
  // Request 1h and aggregate to 4h for provider consistency.
  "4h": { requestTimeframe: "1h", days: 90, bucketMinutes: 240 },
  // UI "1D" should show an intraday day view, not 1-year daily candles.
  "1D": { requestTimeframe: "5m", days: 2 },
  // Keep weekly as weekly bars over a longer horizon.
  "1W": { requestTimeframe: "1W", days: 900 },
  // UI "1M" should show a month window with daily candles.
  "1M": { requestTimeframe: "1D", days: 45 }
};

const aggregateBars = (rows: OHLCV[], bucketMinutes: number): OHLCV[] => {
  if (!rows.length) return rows;
  const bucketMs = bucketMinutes * 60_000;
  const sorted = [...rows].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const aggregated = new Map<number, OHLCV>();
  for (const row of sorted) {
    const ts = new Date(row.time).getTime();
    if (!Number.isFinite(ts)) continue;
    const bucketStart = Math.floor(ts / bucketMs) * bucketMs;
    const current = aggregated.get(bucketStart);
    if (!current) {
      aggregated.set(bucketStart, {
        time: new Date(bucketStart).toISOString(),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume
      });
      continue;
    }
    current.high = Math.max(current.high, row.high);
    current.low = Math.min(current.low, row.low);
    current.close = row.close;
    current.volume += row.volume;
  }
  return Array.from(aggregated.values()).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
};

export const useOHLCV = (ticker: string, timeframe: Timeframe) =>
  useQuery({
    queryKey: ["ohlcv", ticker, timeframe],
    queryFn: async () => {
      const chartRequest = chartRequestByTimeframe[timeframe];
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - chartRequest.days);
      const rows = await stockService.getOHLCV(ticker, chartRequest.requestTimeframe, from, to);
      if (!chartRequest.bucketMinutes) return rows;
      return aggregateBars(rows, chartRequest.bucketMinutes);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: Boolean(ticker)
  });
