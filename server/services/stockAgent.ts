/**
 * Stock Analysis Agent
 *
 * Analyzes individual stocks and provides AI-powered recommendations
 * including entry/exit points, risk assessment, and action checklists.
 */

import { callLLM, parseAnalysisResponse, isAgentEnabled } from "./llmClient";
import type { OHLCV, Quote, NewsArticle } from "../../src/types";

export interface StockAnalysis {
  symbol: string;
  timestamp: string;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number; // 0-100
  summary: string; // One-sentence core conclusion
  entryPrice: {
    low: number;
    high: number;
  };
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: number;
  technicalAnalysis: {
    trend: "BULLISH" | "BEARISH" | "NEUTRAL";
    momentum: "STRONG_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "STRONG_NEGATIVE";
    support: number[];
    resistance: number[];
    maAlignment: "BULLISH" | "BEARISH" | "MIXED";
    rsiLevel: "OVERBOUGHT" | "BULLISH" | "NEUTRAL" | "BEARISH" | "OVERSOLD";
  };
  fundamentalAnalysis?: {
    valuationAssessment: "UNDervalued" | "FAIRLY_VALUED" | "OVERVALUED";
    keyMetrics: Record<string, string | number>;
  };
  sentimentAnalysis: {
    overall: "BULLISH" | "NEUTRAL" | "BEARISH";
    score: number; // -1 to 1
    recentNewsSummary: string;
  };
  insiderActivity?: {
    signal: "BULLISH" | "NEUTRAL" | "BEARISH";
    confidence: number;
    summary: string;
    sourceUrl: string;
  };
  checklist: {
    item: string;
    status: "Met" | "Caution" | "Not Met";
    note?: string;
  }[];
  risks: string[];
  catalysts: string[];
  rawResponse?: string; // For debugging
}

interface AnalysisContext {
  quote: Quote | null;
  ohlcv: OHLCV[];
  news: NewsArticle[];
  indicators: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    ema20?: number;
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    atr?: number;
    volumeAvg20?: number;
    currentVolume?: number;
  };
  insiderActivity?: {
    signal: "bullish" | "bearish" | "neutral";
    confidence: number;
    tradesFound: number;
    summary: string;
    sourceUrl: string;
  };
  marketContext?: {
    spyChange?: number;
    qqqChange?: number;
    vix?: number;
  };
}

/**
 * Analyze a stock using AI agent
 */
export async function analyzeStock(
  symbol: string,
  context: AnalysisContext
): Promise<StockAnalysis | null> {
  if (!isAgentEnabled()) {
    return null;
  }

  const prompt = buildAnalysisPrompt(symbol, context);

  try {
    const response = await callLLM([
      {
        role: "system",
        content: `You are a professional stock analyst. Analyze the given stock data and provide actionable investment recommendations.

Always respond with valid JSON in this exact schema:
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": number (0-100),
  "summary": string (one sentence in English),
  "entryPrice": { "low": number, "high": number },
  "targetPrice": number,
  "stopLoss": number,
  "riskRewardRatio": number,
  "technicalAnalysis": {
    "trend": "BULLISH" | "BEARISH" | "NEUTRAL",
    "momentum": "STRONG_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "STRONG_NEGATIVE",
    "support": number[],
    "resistance": number[],
    "maAlignment": "BULLISH" | "BEARISH" | "MIXED",
    "rsiLevel": "OVERBOUGHT" | "BULLISH" | "NEUTRAL" | "BEARISH" | "OVERSOLD"
  },
  "sentimentAnalysis": {
    "overall": "BULLISH" | "NEUTRAL" | "BEARISH",
    "score": number (-1 to 1),
    "recentNewsSummary": string
  },
  "checklist": [{ "item": string, "status": "Met" | "Caution" | "Not Met", "note": string? }],
  "risks": string[],
  "catalysts": string[]
}

Be concise but specific. Use actual price levels from the data.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ], {
      temperature: 0.3,
      maxTokens: 1500,
    });

    const parsed = parseAnalysisResponse<Omit<StockAnalysis, "symbol" | "timestamp" | "rawResponse">>(response.content);

    if (!parsed) {
      // Fallback: create a basic analysis from the raw response
      return createFallbackAnalysis(symbol, context, response.content);
    }

    return {
      ...parsed,
      symbol,
      timestamp: new Date().toISOString(),
      rawResponse: response.content,
    };
  } catch (error) {
    console.error(`[Agent] Error analyzing ${symbol}:`, error);
    return createFallbackAnalysis(symbol, context, "Analysis failed due to API error");
  }
}

function buildAnalysisPrompt(symbol: string, context: AnalysisContext): string {
  const { quote, ohlcv, news, indicators, insiderActivity, marketContext } = context;

  const priceInfo = quote
    ? `
Current Price: $${quote.price.toFixed(2)}
Change: ${quote.change > 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)
`
    : "Price data unavailable";

  const ohlcvData = ohlcv.slice(-20).map((bar) =>
    `${bar.time}: O:${bar.open} H:${bar.high} L:${bar.low} C:${bar.close} V:${bar.volume}`
  ).join("\n");

  const indicatorInfo = `
Technical Indicators:
- SMA20: ${indicators.sma20?.toFixed(2) ?? "N/A"}
- SMA50: ${indicators.sma50?.toFixed(2) ?? "N/A"}
- SMA200: ${indicators.sma200?.toFixed(2) ?? "N/A"}
- RSI(14): ${indicators.rsi?.toFixed(2) ?? "N/A"}
- MACD: ${indicators.macd ? `MACD=${indicators.macd.value.toFixed(3)}, Signal=${indicators.macd.signal.toFixed(3)}, Hist=${indicators.macd.histogram.toFixed(3)}` : "N/A"}
- ATR: ${indicators.atr?.toFixed(2) ?? "N/A"}
- Volume: ${indicators.currentVolume?.toLocaleString() ?? "N/A"} vs Avg ${indicators.volumeAvg20?.toLocaleString() ?? "N/A"}
`;

  const newsInfo = news.length > 0
    ? `
Recent News (up to 5):
${news.slice(0, 5).map((n) => `- [${n.sentimentLabel.toUpperCase()}] ${n.headline} (${n.source}, ${n.publishedAt.slice(0, 10)})`).join("\n")}
`
    : "No recent news";

  const insiderInfo = insiderActivity
    ? `
Insider Activity (OpenInsider):
- Signal: ${insiderActivity.signal.toUpperCase()} (confidence ${insiderActivity.confidence}%)
- Filings analyzed: ${insiderActivity.tradesFound}
- Summary: ${insiderActivity.summary}
- Source: ${insiderActivity.sourceUrl}
`
    : "Insider Activity (OpenInsider): No recent insider filing summary available.";

  const marketInfo = marketContext
    ? `
Market Context:
- SPY: ${marketContext.spyChange?.toFixed(2) ?? "N/A"}%
- QQQ: ${marketContext.qqqChange?.toFixed(2) ?? "N/A"}%
- VIX: ${marketContext.vix?.toFixed(2) ?? "N/A"}
`
    : "";

  return `Analyze investment opportunity for ${symbol}

${priceInfo}

Last 20 OHLCV bars:
${ohlcvData}

${indicatorInfo}${newsInfo}
${insiderInfo}
${marketInfo}

Please provide:
1. Clear investment recommendation (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)
2. Confidence level (0-100)
3. One-sentence core conclusion
4. Precise entry zone, target price, stop loss
5. Technical analysis (trend, momentum, support/resistance, MA alignment, RSI level)
6. Sentiment analysis (based on news)
7. Checklist (chasing risk, MA bullish alignment, volume-price relationship, etc.)
8. Main risks
9. Potential catalysts

Respond in JSON format.`;
}

function createFallbackAnalysis(
  symbol: string,
  context: AnalysisContext,
  rawResponse: string
): StockAnalysis {
  const { quote, indicators } = context;
  const price = quote?.price ?? 100;

  // Basic technical analysis from available data
  const rsiLevel = indicators.rsi
    ? indicators.rsi > 70
      ? "OVERBOUGHT"
      : indicators.rsi > 55
      ? "BULLISH"
      : indicators.rsi > 45
      ? "NEUTRAL"
      : indicators.rsi > 30
      ? "BEARISH"
      : "OVERSOLD"
    : "NEUTRAL";

  const maAlignment =
    indicators.sma20 && indicators.sma50 && indicators.sma200
      ? indicators.sma20 > indicators.sma50 && indicators.sma50 > indicators.sma200
        ? "BULLISH"
        : indicators.sma20 < indicators.sma50 && indicators.sma50 < indicators.sma200
        ? "BEARISH"
        : "MIXED"
      : "MIXED";

  const stopLoss = price * 0.95;
  const targetPrice = price * 1.10;

  return {
    symbol,
    timestamp: new Date().toISOString(),
    recommendation: "HOLD",
    confidence: 50,
    summary: "Unable to generate complete AI analysis, please check API configuration",
    entryPrice: { low: price * 0.99, high: price * 1.01 },
    targetPrice,
    stopLoss,
    riskRewardRatio: (targetPrice - price) / (price - stopLoss),
    technicalAnalysis: {
      trend: maAlignment === "BULLISH" ? "BULLISH" : maAlignment === "BEARISH" ? "BEARISH" : "NEUTRAL",
      momentum: "NEUTRAL",
      support: [price * 0.98, price * 0.95],
      resistance: [price * 1.02, price * 1.05],
      maAlignment,
      rsiLevel,
    },
    sentimentAnalysis: {
      overall: "NEUTRAL",
      score: 0,
      recentNewsSummary: context.news.length > 0 ? `${context.news.length} news articles, no sentiment analysis performed` : "No news data",
    },
    insiderActivity: context.insiderActivity
      ? {
          signal:
            context.insiderActivity.signal === "bullish"
              ? "BULLISH"
              : context.insiderActivity.signal === "bearish"
                ? "BEARISH"
                : "NEUTRAL",
          confidence: context.insiderActivity.confidence,
          summary: context.insiderActivity.summary,
          sourceUrl: context.insiderActivity.sourceUrl
        }
      : undefined,
    checklist: [
      { item: "Bullish MA alignment (MA5>MA10>MA20)", status: maAlignment === "BULLISH" ? "Met" : maAlignment === "BEARISH" ? "Not Met" : "Caution" },
      { item: "Price deviation <5% (not chasing highs)", status: "Caution", note: "Requires manual confirmation" },
      { item: "Volume expansion", status: "Caution", note: "Requires manual confirmation" },
    ],
    risks: ["AI analysis failed, for reference only", "Market volatility risk"],
    catalysts: [],
    rawResponse,
  };
}

/**
 * Batch analyze multiple stocks
 */
export async function batchAnalyzeStocks(
  symbols: string[],
  getContext: (symbol: string) => Promise<AnalysisContext>,
  concurrency = 3
): Promise<(StockAnalysis | null)[]> {
  const results: (StockAnalysis | null)[] = [];

  // Simple concurrent execution with limit
  const queue = [...symbols];
  const inProgress = new Set<string>();

  async function processNext() {
    if (queue.length === 0) return;
    const symbol = queue.shift()!;
    inProgress.add(symbol);

    try {
      const context = await getContext(symbol);
      const analysis = await analyzeStock(symbol, context);
      results.push(analysis);
    } catch (error) {
      console.error(`[Agent] Error in batch analyze ${symbol}:`, error);
      results.push(null);
    } finally {
      inProgress.delete(symbol);
      await processNext();
    }
  }

  // Start concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => processNext());
  await Promise.all(workers);

  return results;
}
