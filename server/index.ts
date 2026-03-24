import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { buildProviders, FallbackStockDataService } from "../src/services/stockDataService";
import { createAlertsRouter } from "./routes/alerts";
import { createAnalysisRouter } from "./routes/analysis";
import { createNewsRouter } from "./routes/news";
import { createOhlcvRouter } from "./routes/ohlcv";
import { createQuotesRouter } from "./routes/quotes";
import { createScreenerRouter } from "./routes/screener";
import { createSettingsRouter } from "./routes/settings";
import { createMacroRouter } from "./routes/macro";
import { createWatchlistsRouter } from "./routes/watchlists";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

const providers = buildProviders({
  polygonApiKey: process.env.POLYGON_API_KEY,
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
  finnhubApiKey: process.env.FINNHUB_API_KEY
});
const stockService = new FallbackStockDataService(providers);

// Chrome DevTools may probe this endpoint on localhost during development.
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

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
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
    redditUserAgent: process.env.REDDIT_USER_AGENT,
    redditSubreddits: (process.env.REDDIT_SUBREDDITS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    rssFeedUrls: (process.env.RSS_FEED_URLS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  })
);
app.use("/api/settings", createSettingsRouter());
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
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
    redditUserAgent: process.env.REDDIT_USER_AGENT,
    redditSubreddits: (process.env.REDDIT_SUBREDDITS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    rssFeedUrls: (process.env.RSS_FEED_URLS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiBaseUrl: process.env.OPENAI_BASE_URL,
    openAiModel: process.env.OPENAI_MODEL,
    llmProvider: process.env.LLM_PROVIDER,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    ollamaApiBase: process.env.OLLAMA_API_BASE,
    ollamaModel: process.env.OLLAMA_MODEL
  })
);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
});
