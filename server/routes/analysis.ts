import { Router } from "express";
import { calculateATR, calculateMACD, calculateRSI, calculateSMA, latestSeriesValue } from "../../src/lib/indicators";
import { aggregateNews } from "../../src/services/newsAggregator";
import { database } from "../db/database";
import type { DailyDecisionDashboard, OHLCV, StockDataProvider, Timeframe } from "../../src/types";

interface AnalysisRouteConfig {
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
  llmProvider?: string;
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  openAiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  ollamaApiBase?: string;
  ollamaModel?: string;
}

const dayRangeByTimeframe: Record<Timeframe, number> = {
  "1m": 2,
  "5m": 5,
  "15m": 10,
  "1h": 30,
  "4h": 90,
  "1D": 365,
  "1W": 900,
  "1M": 1800
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const round = (value: number): number => Number(value.toFixed(2));
const REPORT_SYSTEM_PROMPT =
  "You are a disciplined equity analyst. Produce concise, practical commentary for a dashboard card. No markdown.";

type SupportedLlmProvider = "openai" | "gemini" | "anthropic" | "ollama";

const buildDecision = (ticker: string, timeframe: Timeframe, bars: OHLCV[], sentimentScore: number, articleCount: number): DailyDecisionDashboard => {
  const latest = bars[bars.length - 1];
  const previous = bars[bars.length - 2] ?? latest;
  const price = latest.close;
  const changePercent = previous.close === 0 ? 0 : ((latest.close - previous.close) / previous.close) * 100;

  const rsi14 = latestSeriesValue(calculateRSI(bars, 14));
  const sma20 = latestSeriesValue(calculateSMA(bars, 20));
  const sma50 = latestSeriesValue(calculateSMA(bars, 50));
  const macdHistogram = calculateMACD(bars).slice(-1)[0]?.histogram ?? null;
  const atr14 = latestSeriesValue(calculateATR(bars, 14)) ?? Math.max(0.01, price * 0.01);

  let score = 0;
  if (sma20 !== null && price > sma20) score += 1;
  else score -= 1;
  if (sma20 !== null && sma50 !== null && sma20 > sma50) score += 1;
  else if (sma20 !== null && sma50 !== null) score -= 1;
  if (typeof rsi14 === "number") {
    if (rsi14 < 35) score += 1;
    else if (rsi14 > 70) score -= 1;
  }
  if (typeof macdHistogram === "number") score += macdHistogram >= 0 ? 1 : -1;
  if (sentimentScore >= 60) score += 1;
  else if (sentimentScore <= 40) score -= 1;

  const action = score >= 2 ? "buy" : score <= -2 ? "sell" : "hold";
  const confidence = clamp(Math.round(52 + Math.abs(score) * 9 + Math.min(articleCount, 12)), 50, 94);
  const riskLevel = confidence >= 80 ? "low" : confidence >= 65 ? "medium" : "high";

  const levels =
    action === "buy"
      ? {
          entryMin: round(price * 0.995),
          entryMax: round(price * 1.005),
          stopLoss: round(Math.max(0, price - atr14 * 1.5)),
          target1: round(price + atr14 * 2),
          target2: round(price + atr14 * 3.5)
        }
      : action === "sell"
        ? {
            entryMin: round(price * 0.995),
            entryMax: round(price * 1.005),
            stopLoss: round(price + atr14 * 1.5),
            target1: round(Math.max(0, price - atr14 * 2)),
            target2: round(Math.max(0, price - atr14 * 3.5))
          }
        : {
            entryMin: round(price * 0.99),
            entryMax: round(price * 1.01),
            stopLoss: round(Math.max(0, price - atr14 * 2)),
            target1: round(price + atr14 * 1.5),
            target2: round(price + atr14 * 2.5)
          };

  const checklist = [
    {
      label: "Trend alignment (price vs MA20/MA50)",
      status:
        sma20 !== null && sma50 !== null && price > sma20 && sma20 > sma50
          ? "pass"
          : sma20 !== null && sma50 !== null && price > sma20
            ? "watch"
            : "fail",
      detail:
        sma20 === null || sma50 === null
          ? "Not enough bars for MA trend confirmation."
          : `Price ${price.toFixed(2)} | MA20 ${sma20.toFixed(2)} | MA50 ${sma50.toFixed(2)}`
    },
    {
      label: "Momentum (MACD histogram)",
      status: macdHistogram === null ? "watch" : macdHistogram > 0 ? "pass" : "fail",
      detail: macdHistogram === null ? "Not enough bars for MACD." : `MACD histogram ${macdHistogram.toFixed(4)}`
    },
    {
      label: "Mean-reversion risk (RSI14)",
      status: rsi14 === null ? "watch" : rsi14 > 70 || rsi14 < 30 ? "fail" : rsi14 >= 45 && rsi14 <= 65 ? "pass" : "watch",
      detail: rsi14 === null ? "Not enough bars for RSI." : `RSI14 ${rsi14.toFixed(2)}`
    },
    {
      label: "News sentiment context",
      status: sentimentScore >= 60 ? "pass" : sentimentScore <= 40 ? "fail" : "watch",
      detail: `${articleCount} recent articles | sentiment score ${Math.round(sentimentScore)}/100`
    }
  ] as DailyDecisionDashboard["checklist"];

  const tone = action === "buy" ? "constructive" : action === "sell" ? "defensive" : "neutral";
  const conclusion =
    action === "buy"
      ? `${ticker} is showing ${tone} setup conditions. Consider scaling in near the entry zone with strict risk controls.`
      : action === "sell"
        ? `${ticker} is showing ${tone} conditions. Bias remains cautious unless trend and momentum recover.`
        : `${ticker} is in a ${tone} wait-and-see regime. Monitor breakout or pullback confirmation before acting.`;

  return {
    ticker,
    timeframe,
    generatedAt: new Date().toISOString(),
    conclusion,
    action,
    confidence,
    riskLevel,
    price: round(price),
    changePercent: round(changePercent),
    levels,
    indicators: {
      rsi14,
      macdHistogram,
      sma20,
      sma50
    },
    sentiment: {
      overallScore: Math.round(sentimentScore),
      articleCount
    },
    checklist
  };
};

const buildUserPrompt = (report: DailyDecisionDashboard): string =>
  `Summarize this decision payload in 2-3 sentences with one risk warning and one execution tip: ${JSON.stringify(
    report
  )}`;

const buildFallbackCommentary = (report: DailyDecisionDashboard): string => {
  const riskWarning =
    report.riskLevel === "high"
      ? "Volatility risk is elevated, so position size should remain conservative."
      : report.riskLevel === "medium"
        ? "Risk is moderate, so avoid oversized entries before confirmation."
        : "Risk profile is relatively controlled, but stop discipline still matters.";

  const executionTip =
    report.action === "buy"
      ? `Consider scaling entries near ${report.levels.entryMin}-${report.levels.entryMax} with stop-loss discipline at ${report.levels.stopLoss}.`
      : report.action === "sell"
        ? `Consider defensive sizing near ${report.levels.entryMin}-${report.levels.entryMax} and invalidate above ${report.levels.stopLoss}.`
        : `Wait for confirmation around ${report.levels.entryMin}-${report.levels.entryMax} before increasing directional exposure.`;

  return `${report.conclusion} ${riskWarning} ${executionTip}`;
};

const callOpenAiCompatible = async ({
  endpointBase,
  model,
  apiKey,
  report
}: {
  endpointBase: string;
  model: string;
  apiKey?: string;
  report: DailyDecisionDashboard;
}): Promise<string | undefined> => {
  const endpoint = `${endpointBase.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: REPORT_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: buildUserPrompt(report)
        }
      ]
    })
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() || undefined;
};

const callGemini = async ({
  apiKey,
  model,
  report
}: {
  apiKey: string;
  model: string;
  report: DailyDecisionDashboard;
}): Promise<string | undefined> => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${REPORT_SYSTEM_PROMPT}\n\n${buildUserPrompt(report)}` }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 240
      }
    })
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() || undefined;
};

const callAnthropic = async ({
  apiKey,
  model,
  report
}: {
  apiKey: string;
  model: string;
  report: DailyDecisionDashboard;
}): Promise<string | undefined> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 260,
      temperature: 0.2,
      system: REPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(report)
        }
      ]
    })
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  return (
    payload.content
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("")
      .trim() || undefined
  );
};

const resolveProviderOrder = (config: AnalysisRouteConfig): SupportedLlmProvider[] => {
  const preferred = (config.llmProvider ?? "auto").toLowerCase();
  const available: SupportedLlmProvider[] = [];
  if (config.openAiApiKey) available.push("openai");
  if (config.geminiApiKey) available.push("gemini");
  if (config.anthropicApiKey) available.push("anthropic");
  if (config.ollamaApiBase) available.push("ollama");

  if (preferred === "openai") return available.includes("openai") ? ["openai"] : [];
  if (preferred === "gemini") return available.includes("gemini") ? ["gemini"] : [];
  if (preferred === "anthropic") return available.includes("anthropic") ? ["anthropic"] : [];
  if (preferred === "ollama") return available.includes("ollama") ? ["ollama"] : [];
  if (preferred === "none") return [];

  // auto mode fallback order
  const ordered: SupportedLlmProvider[] = [];
  for (const provider of ["openai", "gemini", "anthropic", "ollama"] as const) {
    if (available.includes(provider)) ordered.push(provider);
  }
  return ordered;
};

const maybeGenerateCommentary = async (
  config: AnalysisRouteConfig,
  report: DailyDecisionDashboard
): Promise<{ text?: string; provider?: string }> => {
  const providers = resolveProviderOrder(config);
  for (const provider of providers) {
    try {
      if (provider === "openai" && config.openAiApiKey) {
        const text = await callOpenAiCompatible({
          endpointBase: config.openAiBaseUrl ?? "https://api.openai.com/v1",
          model: config.openAiModel ?? "gpt-4o-mini",
          apiKey: config.openAiApiKey,
          report
        });
        if (text) return { text, provider: "openai" };
      }
      if (provider === "gemini" && config.geminiApiKey) {
        const text = await callGemini({
          apiKey: config.geminiApiKey,
          model: config.geminiModel ?? "gemini-1.5-flash",
          report
        });
        if (text) return { text, provider: "gemini" };
      }
      if (provider === "anthropic" && config.anthropicApiKey) {
        const text = await callAnthropic({
          apiKey: config.anthropicApiKey,
          model: config.anthropicModel ?? "claude-3-5-haiku-latest",
          report
        });
        if (text) return { text, provider: "anthropic" };
      }
      if (provider === "ollama" && config.ollamaApiBase) {
        const text = await callOpenAiCompatible({
          endpointBase: config.ollamaApiBase,
          model: config.ollamaModel ?? "llama3.1:8b",
          report
        });
        if (text) return { text, provider: "ollama" };
      }
    } catch {
      // Graceful fallback to the next configured provider.
    }
  }
  return {};
};

export const createAnalysisRouter = (stockService: StockDataProvider, config: AnalysisRouteConfig) => {
  const router = Router();
  const analysisCache = new Map<string, { data: DailyDecisionDashboard; cachedAt: number }>();
  const analysisInflight = new Map<string, Promise<DailyDecisionDashboard>>();
  const analysisTtlMs = Number(process.env.ANALYSIS_CACHE_TTL_MS ?? 5 * 60_000);
  const barsTtlMs = Number(process.env.ANALYSIS_OHLCV_TTL_MS ?? 5 * 60_000);

  const getCachedAnalysis = (key: string) => {
    const row = analysisCache.get(key);
    if (!row) return null;
    if (Date.now() - row.cachedAt > analysisTtlMs) return null;
    return row.data;
  };

  router.get("/daily", async (req, res) => {
    try {
      const ticker = String(req.query.ticker ?? "").toUpperCase();
      if (!ticker) return res.status(400).json({ error: "ticker is required" });

      const timeframe = String(req.query.timeframe ?? "1D") as Timeframe;
      const analysisKey = `${ticker}:${timeframe}`;
      const cachedAnalysis = getCachedAnalysis(analysisKey);
      if (cachedAnalysis) return res.json(cachedAnalysis);
      if (analysisInflight.has(analysisKey)) {
        const pending = await analysisInflight.get(analysisKey);
        return res.json(pending);
      }

      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - (dayRangeByTimeframe[timeframe] ?? 365));
      const barsCacheKey = `analysis:bars:${ticker}:${timeframe}`;
      const cachedBars = database.getOHLCVCache(barsCacheKey);

      const task = (async () => {
        const bars = cachedBars ?? (await stockService.getOHLCV(ticker, timeframe, from, to));
        if (!cachedBars && bars.length) {
          database.saveOHLCVCache(barsCacheKey, ticker, timeframe, bars, barsTtlMs);
        }
        if (!bars.length) {
          throw new Error("No OHLCV data available for analysis");
        }

        const newsCacheKey = `news:${ticker}`;
        const cachedNews = database.getNewsCache<{
          articles: Array<unknown>;
          summary: { overallScore: number };
          activeSources: string[];
        }>(newsCacheKey);
        const news =
          cachedNews ??
          (await aggregateNews(
            {
              alphaVantageApiKey: config.alphaVantageApiKey,
              polygonApiKey: config.polygonApiKey,
              newsApiKey: config.newsApiKey,
              finnhubApiKey: config.finnhubApiKey,
              benzingaApiKey: config.benzingaApiKey,
              rssFeedUrls: config.rssFeedUrls,
              redditClientId: config.redditClientId,
              redditClientSecret: config.redditClientSecret,
              redditUserAgent: config.redditUserAgent,
              redditSubreddits: config.redditSubreddits
            },
            ticker
          ));
        if (!cachedNews) {
          database.saveNewsCache(newsCacheKey, news, 15 * 60_000);
        }

        const report = buildDecision(ticker, timeframe, bars, news.summary.overallScore, news.articles.length);
        const commentary = await maybeGenerateCommentary(config, report);
        report.aiCommentary = commentary.text ?? buildFallbackCommentary(report);
        report.aiProvider = commentary.provider ?? "rule-based";
        analysisCache.set(analysisKey, { data: report, cachedAt: Date.now() });
        return report;
      })();

      analysisInflight.set(analysisKey, task);
      const report = await task.finally(() => analysisInflight.delete(analysisKey));
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Daily analysis failed" });
    }
  });

  return router;
};
