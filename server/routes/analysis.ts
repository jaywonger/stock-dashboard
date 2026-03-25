import { Router } from "express";
import { calculateATR, calculateMACD, calculateRSI, calculateSMA, latestSeriesValue } from "../../src/lib/indicators";
import { aggregateNews } from "../../src/services/newsAggregator";
import { database } from "../db/database";
import { fetchOpenInsiderSummary, type OpenInsiderSummary } from "../services/openInsider";
import type {
  AnalystStance,
  AnalystView,
  DailyDecisionDashboard,
  NewsArticle,
  Quote,
  NewsTeamAnalysisReport,
  OHLCV,
  StockDataProvider,
  Timeframe
} from "../../src/types";

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
  llmReasoningEffort?: string;
  openRouterApiKey?: string;
  openRouterBaseUrl?: string;
  openRouterModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  ollamaApiBase?: string;
  ollamaModel?: string;
  openInsiderScoreWeight?: number;
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
const supportedTimeframes: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M"];
const isTimeframe = (value: string): value is Timeframe => supportedTimeframes.includes(value as Timeframe);
const normalizeTimeframe = (value: unknown): Timeframe => {
  if (typeof value !== "string") return "1D";
  const normalized = value.trim();
  return isTimeframe(normalized) ? normalized : "1D";
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const round = (value: number): number => Number(value.toFixed(2));
const REPORT_SYSTEM_PROMPT =
  "You are a disciplined equity analyst. Produce concise, practical commentary for a dashboard card. No markdown.";

type SupportedLlmProvider = "openai" | "openrouter" | "gemini" | "anthropic" | "ollama";
const stanceToNumber = (stance: AnalystStance): number => (stance === "bullish" ? 1 : stance === "bearish" ? -1 : 0);
const numberToStance = (value: number): AnalystStance => (value > 0.2 ? "bullish" : value < -0.2 ? "bearish" : "neutral");
const parseAnalysisDate = (value: string | undefined): string => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const buildDecision = (
  ticker: string,
  timeframe: Timeframe,
  bars: OHLCV[],
  sentimentScore: number,
  articleCount: number,
  insiderActivity?: OpenInsiderSummary,
  insiderScoreWeight = 1.4
): DailyDecisionDashboard => {
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
  const insiderDirection = insiderActivity?.signal === "bullish" ? 1 : insiderActivity?.signal === "bearish" ? -1 : 0;
  const insiderConfidenceFactor = insiderActivity ? clamp(insiderActivity.confidence / 100, 0.55, 1.0) : 0;
  const insiderBreadthFactor = insiderActivity ? clamp(insiderActivity.tradesFound / 8, 0.5, 1.4) : 0;
  const insiderScoreContribution =
    insiderDirection === 0
      ? 0
      : clamp(insiderDirection * insiderScoreWeight * insiderConfidenceFactor * insiderBreadthFactor, -2.5, 2.5);
  score += insiderScoreContribution;

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
    },
    {
      label: "Insider flow (OpenInsider)",
      status:
        insiderActivity?.signal === "bullish"
          ? "pass"
          : insiderActivity?.signal === "bearish"
            ? "fail"
            : "watch",
      detail: insiderActivity
        ? `${insiderActivity.summary} Score impact ${insiderScoreContribution >= 0 ? "+" : ""}${insiderScoreContribution.toFixed(2)}`
        : "No recent insider filings found from OpenInsider."
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
    insiderActivity: insiderActivity
      ? {
          signal: insiderActivity.signal,
          confidence: insiderActivity.confidence,
          tradesFound: insiderActivity.tradesFound,
          summary: insiderActivity.summary,
          sourceUrl: insiderActivity.sourceUrl,
          asOf: insiderActivity.asOf
        }
      : undefined,
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

const buildFlatBarsFromQuote = (quote: Quote, to: Date, timeframe: Timeframe): OHLCV[] => {
  const count = timeframe === "1m" || timeframe === "5m" || timeframe === "15m" ? 80 : 90;
  const stepMs =
    timeframe === "1m"
      ? 60_000
      : timeframe === "5m"
        ? 5 * 60_000
        : timeframe === "15m"
          ? 15 * 60_000
          : timeframe === "1h"
            ? 60 * 60_000
            : timeframe === "4h"
              ? 4 * 60 * 60_000
              : 24 * 60 * 60_000;
  const prevClose = quote.price - quote.change;
  const basePrice = Number.isFinite(prevClose) && prevClose > 0 ? prevClose : quote.price;
  const rows: OHLCV[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const time = new Date(to.getTime() - i * stepMs).toISOString();
    rows.push({
      time,
      open: basePrice,
      high: Math.max(basePrice, quote.price),
      low: Math.min(basePrice, quote.price),
      close: quote.price,
      volume: Math.max(0, quote.volume ?? 0)
    });
  }
  return rows;
};

const buildTeamViews = (ticker: string, bars: OHLCV[], articles: NewsArticle[], newsScore: number): AnalystView[] => {
  const latest = bars.at(-1);
  const sma20 = latestSeriesValue(calculateSMA(bars, 20));
  const sma50 = latestSeriesValue(calculateSMA(bars, 50));
  const rsi14 = latestSeriesValue(calculateRSI(bars, 14)) ?? 50;
  const macd = calculateMACD(bars).at(-1)?.histogram ?? 0;
  const bullishCount = articles.filter((item) => item.sentimentLabel === "bullish").length;
  const bearishCount = articles.filter((item) => item.sentimentLabel === "bearish").length;
  const sourceCount = new Set(articles.map((item) => item.source)).size;

  const marketBiasRaw =
    (latest && sma20 && latest.close > sma20 ? 0.45 : -0.25) +
    (sma20 && sma50 && sma20 > sma50 ? 0.35 : -0.2) +
    (macd >= 0 ? 0.2 : -0.2) +
    (rsi14 > 68 ? -0.15 : rsi14 < 35 ? 0.15 : 0);
  const marketStance = numberToStance(marketBiasRaw);
  const marketConfidence = clamp(Math.round(56 + Math.abs(marketBiasRaw) * 26), 50, 92);

  const sentimentRaw = (newsScore - 50) / 50;
  const sentimentStance = numberToStance(sentimentRaw);
  const sentimentConfidence = clamp(
    Math.round(52 + Math.abs(sentimentRaw) * 34 + Math.min(articles.length, 20) * 0.8),
    50,
    94
  );

  const negativeHeadlineHits = articles.filter((item) =>
    /(downgrade|miss|lawsuit|investigation|cuts|tariff|risk|slowdown|warn)/i.test(`${item.headline} ${item.summary ?? ""}`)
  ).length;
  const positiveHeadlineHits = articles.filter((item) =>
    /(upgrade|beats|growth|buyback|rebound|guidance|record|strong)/i.test(`${item.headline} ${item.summary ?? ""}`)
  ).length;
  const newsRaw = clamp((positiveHeadlineHits - negativeHeadlineHits) / Math.max(articles.length, 1), -1, 1);
  const newsStance = numberToStance(newsRaw);
  const newsConfidence = clamp(Math.round(50 + Math.abs(newsRaw) * 30 + sourceCount * 3), 50, 90);

  const fundamentalsHits = articles.reduce(
    (acc, item) => {
      const text = `${item.headline} ${item.summary ?? ""}`;
      if (/(earnings beat|eps beat|margin expansion|guidance raised|revenue growth)/i.test(text)) acc.pos += 1;
      if (/(earnings miss|guidance cut|margin pressure|debt|downgrade|cash burn)/i.test(text)) acc.neg += 1;
      return acc;
    },
    { pos: 0, neg: 0 }
  );
  const fundamentalsRaw = clamp((fundamentalsHits.pos - fundamentalsHits.neg) / Math.max(articles.length, 1), -1, 1);
  const fundamentalsStance = numberToStance(fundamentalsRaw);
  const fundamentalsConfidence = clamp(Math.round(50 + Math.abs(fundamentalsRaw) * 26 + Math.min(articles.length, 15)), 50, 88);

  return [
    {
      role: "market-analyst",
      stance: marketStance,
      confidence: marketConfidence,
      reasoning: `${ticker} trend check: MA20/MA50 structure, RSI (${rsi14.toFixed(1)}), and MACD histogram (${
        macd >= 0 ? "+" : ""
      }${macd.toFixed(3)}) shape directional bias.`
    },
    {
      role: "sentiment-analyst",
      stance: sentimentStance,
      confidence: sentimentConfidence,
      reasoning: `Aggregate sentiment is ${Math.round(newsScore)}/100 with ${bullishCount} bullish vs ${bearishCount} bearish articles in scope.`
    },
    {
      role: "news-analyst",
      stance: newsStance,
      confidence: newsConfidence,
      reasoning: `Headline flow across ${sourceCount} sources shows ${positiveHeadlineHits} constructive vs ${negativeHeadlineHits} risk-off catalysts.`
    },
    {
      role: "fundamentals-analyst",
      stance: fundamentalsStance,
      confidence: fundamentalsConfidence,
      reasoning: `Fundamental cues in news mention ${fundamentalsHits.pos} positive vs ${fundamentalsHits.neg} negative earnings/quality signals.`
    }
  ];
};

const runDebate = (team: AnalystView[], rounds: number): NewsTeamAnalysisReport["debate"] => {
  let working = team.map((item) => ({ ...item, score: stanceToNumber(item.stance) }));
  const debate: NewsTeamAnalysisReport["debate"] = [];

  for (let round = 1; round <= rounds; round += 1) {
    const avgScore = working.reduce((sum, item) => sum + item.score, 0) / Math.max(working.length, 1);
    working = working.map((item) => {
      const pull = (avgScore - item.score) * 0.22;
      const confidenceDrag = Math.max(0.1, (95 - item.confidence) / 100);
      const score = clamp(item.score + pull * confidenceDrag, -1, 1);
      const confidence = clamp(Math.round(item.confidence + (Math.abs(avgScore) > 0.25 ? 2 : 1)), 50, 95);
      return { ...item, score, confidence };
    });
    const bullVotes = working.filter((item) => item.score > 0.2).length;
    const bearVotes = working.filter((item) => item.score < -0.2).length;
    const neutralVotes = working.length - bullVotes - bearVotes;
    debate.push({
      round,
      summary: `Round ${round}: team alignment moved toward ${numberToStance(avgScore)} (bull ${bullVotes}, neutral ${neutralVotes}, bear ${bearVotes}).`,
      analysts: working.map((item) => ({
        role: item.role,
        stance: numberToStance(item.score),
        confidence: item.confidence,
        reasoning: item.reasoning
      }))
    });
  }

  return debate;
};

const callOpenAiCompatible = async ({
  endpointBase,
  model,
  apiKey,
  reasoningEffort,
  report
}: {
  endpointBase: string;
  model: string;
  apiKey?: string;
  reasoningEffort?: "low" | "medium" | "high";
  report: DailyDecisionDashboard;
}): Promise<string | undefined> => {
  const endpoint = `${endpointBase.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const buildBody = (withReasoningEffort: boolean) => ({
    model,
    temperature: 0.2,
    ...(withReasoningEffort && reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
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
  });

  let response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildBody(true))
  });
  if (!response.ok && reasoningEffort && (response.status === 400 || response.status === 422)) {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody(false))
    });
  }
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
  if (config.openRouterApiKey) available.push("openrouter");
  if (config.geminiApiKey) available.push("gemini");
  if (config.anthropicApiKey) available.push("anthropic");
  if (config.ollamaApiBase) available.push("ollama");

  if (preferred === "openai") return available.includes("openai") ? ["openai"] : [];
  if (preferred === "openrouter") return available.includes("openrouter") ? ["openrouter"] : [];
  if (preferred === "gemini") return available.includes("gemini") ? ["gemini"] : [];
  if (preferred === "anthropic") return available.includes("anthropic") ? ["anthropic"] : [];
  if (preferred === "ollama") return available.includes("ollama") ? ["ollama"] : [];
  if (preferred === "none") return [];

  // auto mode fallback order
  const ordered: SupportedLlmProvider[] = [];
  for (const provider of ["openai", "openrouter", "gemini", "anthropic", "ollama"] as const) {
    if (available.includes(provider)) ordered.push(provider);
  }
  return ordered;
};

const normalizeReasoningEffort = (value?: string): "low" | "medium" | "high" | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "max") return "high";
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return undefined;
};

const normalizeInsiderScoreWeight = (value?: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1.4;
  return clamp(value, 0.2, 3.0);
};

const maybeGenerateCommentary = async (
  config: AnalysisRouteConfig,
  report: DailyDecisionDashboard
): Promise<{ text?: string; provider?: string }> => {
  const providers = resolveProviderOrder(config);
  const reasoningEffort = normalizeReasoningEffort(config.llmReasoningEffort);
  for (const provider of providers) {
    try {
      if (provider === "openai" && config.openAiApiKey) {
        const text = await callOpenAiCompatible({
          endpointBase: config.openAiBaseUrl ?? "https://api.openai.com/v1",
          model: config.openAiModel ?? "gpt-4o-mini",
          apiKey: config.openAiApiKey,
          reasoningEffort,
          report
        });
        if (text) return { text, provider: "openai" };
      }
      if (provider === "openrouter" && config.openRouterApiKey) {
        const text = await callOpenAiCompatible({
          endpointBase: config.openRouterBaseUrl ?? "https://openrouter.ai/api/v1",
          model: config.openRouterModel ?? "openai/gpt-4o-mini",
          apiKey: config.openRouterApiKey,
          reasoningEffort,
          report
        });
        if (text) return { text, provider: "openrouter" };
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
          reasoningEffort,
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
  const openInsiderCache = new Map<string, { data: OpenInsiderSummary; cachedAt: number }>();
  const analysisInflight = new Map<string, Promise<DailyDecisionDashboard>>();
  const analysisTtlMs = Number(process.env.ANALYSIS_CACHE_TTL_MS ?? 5 * 60_000);
  const barsTtlMs = Number(process.env.ANALYSIS_OHLCV_TTL_MS ?? 5 * 60_000);
  const openInsiderTtlMs = Number(process.env.OPENINSIDER_CACHE_TTL_MS ?? 10 * 60_000);

  const getCachedAnalysis = (key: string) => {
    const row = analysisCache.get(key);
    if (!row) return null;
    if (Date.now() - row.cachedAt > analysisTtlMs) return null;
    return row.data;
  };

  const getCachedOpenInsider = (key: string) => {
    const row = openInsiderCache.get(key);
    if (!row) return null;
    if (Date.now() - row.cachedAt > openInsiderTtlMs) return null;
    return row.data;
  };

  const fetchBarsForTimeframe = async (ticker: string, timeframe: Timeframe, to: Date): Promise<OHLCV[]> => {
    const from = new Date(to);
    from.setDate(to.getDate() - (dayRangeByTimeframe[timeframe] ?? 365));
    const barsCacheKey = `analysis:bars:${ticker}:${timeframe}`;
    const cachedBars = database.getOHLCVCache(barsCacheKey);
    if (cachedBars && cachedBars.length > 0) return cachedBars;
    const bars = await stockService.getOHLCV(ticker, timeframe, from, to);
    if (bars.length > 0) {
      database.saveOHLCVCache(barsCacheKey, ticker, timeframe, bars, barsTtlMs);
    }
    return bars;
  };

  const fetchBarsWithFallbacks = async (ticker: string, timeframe: Timeframe, to: Date): Promise<OHLCV[]> => {
    const fallbackOrder: Timeframe[] = [timeframe];
    if (timeframe !== "1D") fallbackOrder.push("1D");
    if ((timeframe === "1m" || timeframe === "5m" || timeframe === "15m") && !fallbackOrder.includes("1h")) {
      fallbackOrder.push("1h");
    }
    if (timeframe === "1M" && !fallbackOrder.includes("1W")) {
      fallbackOrder.push("1W");
    }

    let lastError: unknown;
    for (const candidate of fallbackOrder) {
      try {
        const bars = await fetchBarsForTimeframe(ticker, candidate, to);
        if (bars.length > 0) return bars;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("No OHLCV data available for analysis");
  };

  router.get("/openinsider", async (req, res) => {
    try {
      const ticker = String(req.query.ticker ?? "").toUpperCase().trim();
      if (!ticker) return res.status(400).json({ error: "ticker is required" });

      const cacheKey = `openinsider:${ticker}`;
      const cached = getCachedOpenInsider(cacheKey);
      if (cached) return res.json(cached);

      const summary = await fetchOpenInsiderSummary(ticker);
      if (!summary) return res.status(404).json({ error: "No OpenInsider data available for ticker" });

      openInsiderCache.set(cacheKey, { data: summary, cachedAt: Date.now() });
      return res.json(summary);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "OpenInsider lookup failed" });
    }
  });

  router.get("/daily", async (req, res) => {
    try {
      const ticker = String(req.query.ticker ?? "").toUpperCase().trim();
      if (!ticker) return res.status(400).json({ error: "ticker is required" });

      const timeframe = normalizeTimeframe(req.query.timeframe);
      const analysisKey = `${ticker}:${timeframe}`;
      const cachedAnalysis = getCachedAnalysis(analysisKey);
      if (cachedAnalysis) return res.json(cachedAnalysis);
      if (analysisInflight.has(analysisKey)) {
        const pending = await analysisInflight.get(analysisKey);
        return res.json(pending);
      }

      const to = new Date();

      const task = (async () => {
        let bars: OHLCV[] = [];
        try {
          bars = await fetchBarsWithFallbacks(ticker, timeframe, to);
        } catch {
          // Fallback for symbols/timeframes where candle history can be intermittent.
          const quote = await stockService.getQuote(ticker);
          bars = buildFlatBarsFromQuote(quote, to, timeframe);
        }
        if (!bars.length) throw new Error("No OHLCV data available for analysis");

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

        const insiderActivity = await fetchOpenInsiderSummary(ticker);
        const insiderScoreWeight = normalizeInsiderScoreWeight(config.openInsiderScoreWeight);
        const report = buildDecision(
          ticker,
          timeframe,
          bars,
          news.summary.overallScore,
          news.articles.length,
          insiderActivity,
          insiderScoreWeight
        );
        const commentary: { text?: string; provider?: string } = await withTimeout(
          maybeGenerateCommentary(config, report),
          20_000,
          "AI commentary timed out"
        ).catch(() => ({}));
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

  router.get("/news-team", async (req, res) => {
    try {
      const ticker = String(req.query.ticker ?? "").toUpperCase().trim();
      if (!ticker) return res.status(400).json({ error: "ticker is required" });
      const timeframe = String(req.query.timeframe ?? "1D") as Timeframe;
      const rounds = clamp(Number(req.query.rounds ?? 3), 1, 5);
      const analysisDate = parseAnalysisDate(req.query.analysisDate ? String(req.query.analysisDate) : undefined);
      const windowEnd = new Date(`${analysisDate}T23:59:59.999Z`);
      const windowStart = new Date(windowEnd);
      windowStart.setDate(windowEnd.getDate() - 7);

      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - (dayRangeByTimeframe[timeframe] ?? 365));
      const bars = await stockService.getOHLCV(ticker, timeframe, from, to);
      if (!bars.length) return res.status(400).json({ error: "No OHLCV data available for selected ticker/timeframe" });

      const news = await aggregateNews(
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
      );

      const filteredArticles = news.articles.filter((item) => {
        const ts = new Date(item.publishedAt).getTime();
        return ts >= windowStart.getTime() && ts <= windowEnd.getTime();
      });
      const effectiveArticles = filteredArticles.length > 0 ? filteredArticles : news.articles.slice(0, 40);
      const sentimentScore =
        effectiveArticles.length > 0
          ? Math.round(
              ((effectiveArticles.reduce((sum, item) => sum + item.sentimentScore, 0) / effectiveArticles.length + 1) / 2) *
                100
            )
          : 50;

      const team = buildTeamViews(ticker, bars, effectiveArticles, sentimentScore);
      const debate = runDebate(team, rounds);
      const finalAverage =
        debate.length > 0
          ? debate[debate.length - 1].analysts.reduce((sum, item) => sum + stanceToNumber(item.stance), 0) /
            debate[debate.length - 1].analysts.length
          : team.reduce((sum, item) => sum + stanceToNumber(item.stance), 0) / Math.max(team.length, 1);
      const finalStance = numberToStance(finalAverage);
      const finalConfidence = clamp(
        Math.round((debate.at(-1)?.analysts.reduce((sum, item) => sum + item.confidence, 0) ?? 0) / Math.max(team.length, 1)),
        50,
        95
      );

      const report: NewsTeamAnalysisReport = {
        ticker,
        timeframe,
        analysisDate,
        rounds,
        team,
        debate,
        finalVerdict: {
          stance: finalStance,
          confidence: finalConfidence,
          rationale: `Final consensus after ${rounds} round${rounds > 1 ? "s" : ""} leans ${finalStance} based on price structure, sentiment flow, headline balance, and fundamentals cues from the selected news window.`
        }
      };
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "News team analysis failed" });
    }
  });

  return router;
};
