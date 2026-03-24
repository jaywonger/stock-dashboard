import { Router } from "express";
import { database } from "../db/database";
import type { StockDataProvider } from "../../src/types";

export const createAlertsRouter = (stockService: StockDataProvider) => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ alerts: database.getAlerts() });
  });

  router.post("/", (req, res) => {
    const symbol = String(req.body?.symbol ?? "").toUpperCase();
    const targetPrice = Number(req.body?.targetPrice ?? 0);
    const direction = req.body?.direction === "below" ? "below" : "above";
    if (!symbol || !targetPrice) return res.status(400).json({ error: "Invalid alert payload" });
    const id = database.createAlert(symbol, targetPrice, direction);
    res.status(201).json({ id });
  });

  router.post("/:id/dismiss", (req, res) => {
    database.dismissAlert(Number(req.params.id));
    res.json({ ok: true });
  });

  router.get("/check", async (_req, res) => {
    const active = database.getActiveAlerts();
    const triggeredIds: number[] = [];
    await Promise.all(
      active.map(async (alert) => {
        try {
          const quote = await stockService.getQuote(alert.symbol);
          const hit =
            alert.direction === "above" ? quote.price >= alert.targetPrice : quote.price <= alert.targetPrice;
          if (hit) {
            triggeredIds.push(alert.id);
            database.setAlertTriggered(alert.id);
          }
        } catch {
          // Ignore quote errors during alert polling.
        }
      })
    );

    const alerts = database.getAlerts();
    const triggered = alerts.filter((alert) => triggeredIds.includes(alert.id));
    res.json({ alerts, triggered });
  });

  return router;
};
