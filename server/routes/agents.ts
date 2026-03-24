/**
 * AI Agents API Routes
 *
 * Endpoints for:
 * - Stock analysis agent
 * - Conversational chat agent
 * - Autonomous monitor agent
 */

import { Router } from "express";
import { aggregateNews } from "../../src/services/newsAggregator";
import type { NewsArticle } from "../../src/types";
import { analyzeStock, batchAnalyzeStocks } from "../services/stockAgent";
import { chatWithAgent, compareStocks } from "../services/chatAgent";
import { runWatchlistMonitor, prioritizeAlerts } from "../services/monitorAgent";
import { isAgentEnabled } from "../services/llmClient";
import type { FallbackStockDataService } from "../../src/services/stockDataService";

interface AgentRouterDeps {
  stockService: FallbackStockDataService;
}

export function createAgentsRouter({ stockService }: AgentRouterDeps) {
  const router = Router();
  const loadNews = async (symbol: string, limit: number): Promise<NewsArticle[]> => {
    const result = await aggregateNews(
      {
        alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
        polygonApiKey: process.env.POLYGON_API_KEY,
        newsApiKey: process.env.NEWSAPI_KEY,
        finnhubApiKey: process.env.FINNHUB_API_KEY,
        benzingaApiKey: process.env.BENZINGA_API_KEY,
        rssFeedUrls: (process.env.RSS_FEED_URLS ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        redditClientId: process.env.REDDIT_CLIENT_ID,
        redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
        redditUserAgent: process.env.REDDIT_USER_AGENT,
        redditSubreddits: (process.env.REDDIT_SUBREDDITS ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
      symbol
    );
    return result.articles.slice(0, limit);
  };

  // ===== Stock Analysis Agent =====

  /**
   * Analyze a single stock
   * POST /api/agents/analyze/:symbol
   * Body: { timeframe?: string }
   */
  router.post("/analyze/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { timeframe = "1D" } = req.query;

      // Fetch required data
      const [quote, ohlcv, news] = await Promise.all([
        stockService.getQuote(symbol).catch(() => null),
        stockService.getOHLCV(symbol, timeframe as any, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()).catch(() => []),
        loadNews(symbol, 10).catch(() => []),
      ]);

      // Calculate indicators
      const indicators = await calculateIndicators(ohlcv);

      const analysis = await analyzeStock(symbol, {
        quote,
        ohlcv,
        news,
        indicators,
      });

      if (!analysis) {
        return res.status(503).json({
          error: "Agent not enabled",
          message: "Configure AI API keys in settings to enable analysis",
        });
      }

      res.json(analysis);
    } catch (error) {
      console.error("[Agents API] Error analyzing stock:", error);
      res.status(500).json({ error: "Analysis failed", message: String(error) });
    }
  });

  /**
   * Batch analyze multiple stocks
   * POST /api/agents/analyze/batch
   * Body: { symbols: string[] }
   */
  router.post("/analyze/batch", async (req, res) => {
    try {
      const { symbols = [] } = req.body;
      const { timeframe = "1D" } = req.query;

      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: "symbols array required" });
      }

      const getContext = async (symbol: string) => {
        const [quote, ohlcv, news] = await Promise.all([
          stockService.getQuote(symbol).catch(() => null),
          stockService.getOHLCV(symbol, timeframe as any, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()).catch(() => []),
          loadNews(symbol, 5).catch(() => []),
        ]);
        return { quote, ohlcv, news, indicators: await calculateIndicators(ohlcv) };
      };

      const results = await batchAnalyzeStocks(symbols, getContext, 3);

      res.json({ results });
    } catch (error) {
      console.error("[Agents API] Error in batch analysis:", error);
      res.status(500).json({ error: "Batch analysis failed" });
    }
  });

  // ===== Chat Agent =====

  /**
   * Chat with AI agent
   * POST /api/agents/chat
   * Body: { message: string, history?: ChatMessage[] }
   */
  router.post("/chat", async (req, res) => {
    try {
      const { message, history = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: "message required" });
      }

      // Get market context
      const marketOverview = {
        spyChange: 0, // Could fetch from stockService
        qqqChange: 0,
        vix: 0,
        marketStatus: "OPEN",
      };

      const chatResponse = await chatWithAgent({
        userQuestion: message,
        history,
        data: {
          marketOverview,
        },
      });

      res.json({ message: chatResponse });
    } catch (error) {
      console.error("[Agents API] Chat error:", error);
      res.status(500).json({ error: "Chat failed" });
    }
  });

  /**
   * Compare multiple stocks
   * POST /api/agents/compare
   * Body: { symbols: string[] }
   */
  router.post("/compare", async (req, res) => {
    try {
      const { symbols = [] } = req.body;

      if (!Array.isArray(symbols) || symbols.length < 2) {
        return res.status(400).json({ error: "At least 2 symbols required" });
      }

      const getContext = async (symbol: string) => ({
        quote: await stockService.getQuote(symbol).catch(() => null),
        ohlcv: await stockService.getOHLCV(symbol, "1D", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()).catch(() => []),
        news: await loadNews(symbol, 5).catch(() => []),
      });

      const comparison = await compareStocks(symbols, getContext);

      res.json({ message: comparison });
    } catch (error) {
      console.error("[Agents API] Compare error:", error);
      res.status(500).json({ error: "Comparison failed" });
    }
  });

  /**
   * Export chat session
   * GET /api/agents/chat/:sessionId/export
   */
  router.get("/chat/:sessionId/export", (_req, res) => {
    // In production, you'd load the session from database
    // For now, return a placeholder
    res.json({ error: "Not implemented - session storage required" });
  });

  // ===== Monitor Agent =====

  /**
   * Monitor watchlist for alerts
   * GET /api/agents/monitor
   */
  router.get("/monitor", async (req, res) => {
    try {
      const { symbols = "" } = req.query;
      const symbolList = typeof symbols === "string" ? symbols.split(",").filter(Boolean) : [];
      const includeNewsSentiment = String(req.query.includeNewsSentiment ?? "false").toLowerCase() === "true";

      if (symbolList.length === 0) {
        return res.status(400).json({ error: "symbols query param required" });
      }

      const getData = async (symbol: string) => {
        const [quote, ohlcv] = await Promise.all([
          stockService.getQuote(symbol).catch(() => null),
          stockService.getOHLCV(symbol, "1D", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()).catch(() => []),
        ]);
        const news = includeNewsSentiment ? await loadNews(symbol, 10).catch(() => []) : [];

        if (!quote) {
          throw new Error(`No quote for ${symbol}`);
        }

        return {
          symbol,
          quote,
          ohlcv,
          news,
        };
      };

      const alerts = await runWatchlistMonitor(symbolList, getData, 3);
      const prioritized = prioritizeAlerts(Object.values(alerts).flat());

      res.json({ alerts: prioritized, bySymbol: alerts });
    } catch (error) {
      console.error("[Agents API] Monitor error:", error);
      res.status(500).json({ error: "Monitoring failed" });
    }
  });

  /**
   * Check agent status
   * GET /api/agents/status
   */
  router.get("/status", (_req, res) => {
    const enabled = isAgentEnabled();
    const config = {
      enabled,
      model: process.env.LITELLM_MODEL || "gemini/gemini-2.0-flash",
      hasApiKey: !!(
        process.env.LITELLM_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.CLAUDE_API_KEY
      ),
    };
    res.json({ status: config });
  });

  return router;
}

// ===== Helper Functions =====

async function calculateIndicators(ohlcv: any[]) {
  if (!ohlcv || ohlcv.length === 0) {
    return {};
  }
  const toOptionalNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  // SMA calculations
  const sma20 = calculateSMA(ohlcv, 20);
  const sma50 = calculateSMA(ohlcv, 50);
  const sma200 = calculateSMA(ohlcv, 200);

  // EMA calculations
  const ema20 = calculateEMA(ohlcv, 20);

  // RSI
  const rsi = calculateRSI(ohlcv);

  // MACD
  const macd = calculateMACD(ohlcv);

  // ATR
  const atr = calculateATR(ohlcv);

  // Volume average
  const volumes = ohlcv.slice(-20).map((b: any) => b.volume);
  const volumeAvg20 = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
  const currentVolume = ohlcv[ohlcv.length - 1]?.volume;

  return {
    sma20: toOptionalNumber(sma20),
    sma50: toOptionalNumber(sma50),
    sma200: toOptionalNumber(sma200),
    ema20: toOptionalNumber(ema20),
    rsi: toOptionalNumber(rsi),
    macd: macd ?? undefined,
    atr: toOptionalNumber(atr),
    volumeAvg20,
    currentVolume: toOptionalNumber(currentVolume),
  };
}

function calculateSMA(ohlcv: any[], period: number): number | null {
  if (ohlcv.length < period) return null;
  const closes = ohlcv.slice(-period).map((bar) => bar.close);
  return closes.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(ohlcv: any[], period: number): number | null {
  if (ohlcv.length < period) return null;

  const multiplier = 2 / (period + 1);
  const sma = calculateSMA(ohlcv, period);
  if (!sma) return null;

  let ema = sma;
  for (let i = ohlcv.length - period; i < ohlcv.length; i++) {
    ema = (ohlcv[i].close - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRSI(ohlcv: any[], period = 14): number | null {
  if (ohlcv.length < period + 1) return null;

  const closes = ohlcv.map((bar) => bar.close);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(ohlcv: any[]) {
  const ema12 = calculateEMA(ohlcv, 12);
  const ema26 = calculateEMA(ohlcv, 26);

  if (!ema12 || !ema26) return null;

  const macdLine = ema12 - ema26;
  // Signal line would need historical MACD values
  // Simplified for now
  return {
    value: macdLine,
    signal: macdLine * 0.9, // Placeholder
    histogram: macdLine * 0.1, // Placeholder
  };
}

function calculateATR(ohlcv: any[], period = 14): number | null {
  if (ohlcv.length < period) return null;

  const trueRanges = ohlcv.slice(-period).map((bar, i, arr) => {
    const prev = arr[i - 1] || bar;
    const highLow = bar.high - bar.low;
    const highClose = Math.abs(bar.high - prev.close);
    const lowClose = Math.abs(bar.low - prev.close);
    return Math.max(highLow, highClose, lowClose);
  });

  return trueRanges.reduce((a, b) => a + b, 0) / period;
}
