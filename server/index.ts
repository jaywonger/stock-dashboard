import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { Server } from "node:http";
import { buildProviders, FallbackStockDataService } from "../src/services/stockDataService";
import { createAlertsRouter } from "./routes/alerts";
import { createAnalysisRouter } from "./routes/analysis";
import { createMacroRouter } from "./routes/macro";
import { createNewsRouter } from "./routes/news";
import { createOhlcvRouter } from "./routes/ohlcv";
import { createQuotesRouter } from "./routes/quotes";
import { createScreenerRouter } from "./routes/screener";
import { createSettingsRouter } from "./routes/settings";
import { createWatchlistsRouter } from "./routes/watchlists";
import { createAgentsRouter } from "./routes/agents";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PORT ?? 3000);

const providers = buildProviders({
  polygonApiKey: process.env.POLYGON_API_KEY,
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
  finnhubApiKey: process.env.FINNHUB_API_KEY
});
const stockService = new FallbackStockDataService(providers);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    providers: providers.map((provider) => provider.id),
    now: new Date().toISOString()
  });
});

app.use("/api/quotes", createQuotesRouter(stockService));
app.use("/api/ohlcv", createOhlcvRouter(stockService));
app.use("/api/screener", createScreenerRouter(stockService));
app.use("/api/watchlists", createWatchlistsRouter(stockService));
app.use("/api/alerts", createAlertsRouter(stockService));
app.use(
  "/api/news",
  createNewsRouter({
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
      .filter(Boolean)
  })
);
app.use("/api/settings", createSettingsRouter());
app.use("/api/agents", createAgentsRouter({ stockService }));
app.use(
  "/api/macro",
  createMacroRouter({
    fredApiKey: process.env.FRED_API_KEY
  })
);
app.use(
  "/api/analysis",
  createAnalysisRouter(stockService, {
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
    llmProvider: process.env.LLM_PROVIDER,
    llmReasoningEffort: process.env.LLM_REASONING_EFFORT,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiBaseUrl: process.env.OPENAI_BASE_URL,
    openAiModel: process.env.OPENAI_MODEL,
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openRouterBaseUrl: process.env.OPENROUTER_BASE_URL,
    openRouterModel: process.env.OPENROUTER_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    anthropicApiKey: process.env.CLAUDE_API_KEY,
    anthropicModel: process.env.CLAUDE_MODEL,
    ollamaApiBase: process.env.OLLAMA_API_BASE,
    ollamaModel: process.env.OLLAMA_MODEL,
    openInsiderScoreWeight: Number(process.env.OPENINSIDER_SCORE_WEIGHT ?? 1.4)
  })
);

const maxPortRetries = 8;
const startServer = (preferredPort: number, attempt = 0): Server => {
  const activePort = preferredPort + attempt;
  const server = app.listen(activePort, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${activePort}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && attempt < maxPortRetries) {
      // eslint-disable-next-line no-console
      console.warn(`[api] Port ${activePort} in use, trying ${activePort + 1}...`);
      startServer(preferredPort, attempt + 1);
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[api] Failed to start server:", error);
    process.exit(1);
  });

  return server;
};

startServer(port);
