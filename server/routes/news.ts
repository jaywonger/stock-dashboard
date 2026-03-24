import { Router } from "express";
import { aggregateNews } from "../../src/services/newsAggregator";
import { database } from "../db/database";

interface NewsRouteConfig {
  alphaVantageApiKey?: string;
  polygonApiKey?: string;
  newsApiKey?: string;
  finnhubApiKey?: string;
  benzingaApiKey?: string;
  rssFeedUrls?: string[];
  redditClientId?: string;
  redditClientSecret?: string;
  redditUserAgent?: string;
  redditSubreddits?: string[];
}

export const createNewsRouter = (config: NewsRouteConfig) => {
  const router = Router();
  const freshTtlMs = 15 * 60_000;
  const staleTtlMs = 60 * 60_000;
  const bootstrapTimeoutMs = Number(process.env.NEWS_BOOTSTRAP_TIMEOUT_MS ?? 8_000);
  const fallbackPayload = {
    articles: [],
    summary: { overallScore: 50, topBullish: [], topBearish: [], trend: [] },
    activeSources: []
  };
  const cache = new Map<
    string,
    {
      value: { articles: unknown[]; summary: unknown; activeSources: string[] };
      cachedAt: number;
    }
  >();
  const inflight = new Map<string, Promise<void>>();

  const refreshKey = async (cacheKey: string, ticker?: string): Promise<void> => {
    if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;
    const promise = (async () => {
      try {
        const result = await aggregateNews(config, ticker);
        database.saveNewsCache(cacheKey, result, freshTtlMs);
        cache.set(cacheKey, { value: result, cachedAt: Date.now() });
      } catch {
        // Keep stale cache if refresh fails.
      }
    })().finally(() => {
      inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, promise);
    return promise;
  };

  router.get("/", async (req, res) => {
    try {
      const ticker = req.query.ticker ? String(req.query.ticker).toUpperCase() : undefined;
      const cacheKey = `news:${ticker ?? "all"}`;
      const now = Date.now();
      const mem = cache.get(cacheKey);

      if (mem && now - mem.cachedAt <= freshTtlMs) {
        return res.json(mem.value);
      }

      const cached = database.getNewsCache<{ articles: unknown[]; summary: unknown; activeSources: string[] }>(cacheKey);
      if (cached) {
        cache.set(cacheKey, { value: cached, cachedAt: now });
        return res.json(cached);
      }

      // Stale-while-revalidate from memory cache.
      if (mem && now - mem.cachedAt <= staleTtlMs) {
        void refreshKey(cacheKey, ticker);
        return res.json(mem.value);
      }

      await Promise.race([
        refreshKey(cacheKey, ticker),
        new Promise<void>((resolve) => setTimeout(resolve, bootstrapTimeoutMs))
      ]);
      const updated = cache.get(cacheKey);
      if (updated) return res.json(updated.value);
      res.json(fallbackPayload);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "News aggregation failed" });
    }
  });

  return router;
};
