import { Router } from "express";
import { database } from "../db/database";
import type { StockDataProvider, Timeframe } from "../../src/types";

const ttlByTimeframe: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 60_000,
  "15m": 60_000,
  "1h": 5 * 60_000,
  "4h": 10 * 60_000,
  "1D": 4 * 60 * 60_000,
  "1W": 4 * 60 * 60_000,
  "1M": 4 * 60 * 60_000
};

export const createOhlcvRouter = (stockService: StockDataProvider) => {
  const router = Router();

  router.get("/:ticker", async (req, res) => {
    try {
      const ticker = String(req.params.ticker ?? "").toUpperCase();
      const timeframe = String(req.query.timeframe ?? "1D") as Timeframe;
      const from = new Date(String(req.query.from ?? new Date(Date.now() - 90 * 24 * 3600 * 1000)));
      const to = new Date(String(req.query.to ?? new Date()));
      const cacheKey = `${ticker}:${timeframe}:${from.toISOString()}:${to.toISOString()}`;
      const cached = database.getOHLCVCache(cacheKey);
      if (cached) return res.json(cached);

      const rows = await stockService.getOHLCV(ticker, timeframe, from, to);
      database.saveOHLCVCache(cacheKey, ticker, timeframe, rows, ttlByTimeframe[timeframe] ?? 60_000);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "OHLCV failed" });
    }
  });

  return router;
};
