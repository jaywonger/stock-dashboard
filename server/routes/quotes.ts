import { Router } from "express";
import type { StockDataProvider } from "../../src/types";

export const createQuotesRouter = (stockService: StockDataProvider) => {
  const router = Router();

  router.get("/market-status", async (_req, res) => {
    try {
      const data = await stockService.getMarketStatus();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Market status failed" });
    }
  });

  router.get("/search", async (req, res) => {
    try {
      const q = String(req.query.q ?? "");
      if (!q.trim()) return res.json([]);
      const data = await stockService.search(q);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Search failed" });
    }
  });

  router.get("/:ticker", async (req, res) => {
    try {
      const ticker = String(req.params.ticker ?? "").toUpperCase();
      const quote = await stockService.getQuote(ticker);
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Quote failed" });
    }
  });

  return router;
};
