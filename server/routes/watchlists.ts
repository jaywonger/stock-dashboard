import { Router } from "express";
import { database } from "../db/database";
import type { StockDataProvider } from "../../src/types";

export const createWatchlistsRouter = (stockService: StockDataProvider) => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(database.getWatchlists());
  });

  router.post("/", (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name required" });
    try {
      const id = database.createWatchlist(name);
      res.status(201).json({ id });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Create watchlist failed" });
    }
  });

  router.post("/:id/items", async (req, res) => {
    const watchlistId = Number(req.params.id);
    const symbol = String(req.body?.symbol ?? "").toUpperCase().trim();
    if (!watchlistId || !symbol) return res.status(400).json({ error: "watchlist id and symbol required" });
    try {
      const quote = await stockService.getQuote(symbol);
      database.addWatchlistItem(watchlistId, symbol, quote.companyName || symbol);
      res.status(201).json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid symbol" });
    }
  });

  router.delete("/:id/items/:symbol", (req, res) => {
    const watchlistId = Number(req.params.id);
    const symbol = String(req.params.symbol ?? "").toUpperCase();
    database.removeWatchlistItem(watchlistId, symbol);
    res.json({ ok: true });
  });

  return router;
};
