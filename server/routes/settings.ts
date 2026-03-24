import { Router } from "express";

const withTimeout = async (promise: Promise<Response>, ms = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timeout);
  }
};

export const createSettingsRouter = () => {
  const router = Router();

  router.get("/test", async (req, res) => {
    const source = String(req.query.source ?? "");
    const key = String(req.query.key ?? "");
    if (!source || !key) return res.status(400).json({ ok: false, message: "Source and key are required" });

    try {
      let url = "";
      switch (source) {
        case "polygonApiKey":
          url = `https://api.polygon.io/v2/aggs/ticker/SPY/prev?apiKey=${key}`;
          break;
        case "alphaVantageApiKey":
          url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${key}`;
          break;
        case "finnhubApiKey":
          url = `https://finnhub.io/api/v1/quote?symbol=SPY&token=${key}`;
          break;
        case "newsApiKey":
          url = `https://newsapi.org/v2/top-headlines?category=business&pageSize=1&apiKey=${key}`;
          break;
        case "benzingaApiKey":
          url = `https://api.benzinga.com/api/v2/news?token=${key}`;
          break;
        case "fredApiKey":
          url =
            `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS` +
            `&api_key=${encodeURIComponent(key)}&file_type=json&limit=1`;
          break;
        default:
          return res.status(400).json({ ok: false, message: "Unknown source" });
      }
      const response = await withTimeout(fetch(url));
      if (!response.ok) return res.status(400).json({ ok: false, message: "Connection failed" });
      res.json({ ok: true, message: "Connected" });
    } catch {
      res.status(400).json({ ok: false, message: "Connection failed" });
    }
  });

  return router;
};
