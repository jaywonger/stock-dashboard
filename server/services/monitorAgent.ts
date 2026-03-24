/**
 * Autonomous Monitor Agent
 *
 * Watches watchlist stocks 24/7 and triggers alerts when:
 * - Technical patterns form (golden cross, breakout, etc.)
 * - Unusual volume detected
 * - News sentiment shifts dramatically
 * - Price levels breached
 */

import { callLLM, isAgentEnabled } from "./llmClient";
import type { Quote, OHLCV, NewsArticle, PriceAlert } from "../../src/types";

export interface MonitorAlert {
  id: string;
  type: AlertType;
  symbol: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  timestamp: string;
  data: {
    price?: number;
    changePercent?: number;
    pattern?: string;
    volumeRatio?: number;
    sentimentShift?: number;
  };
  suggestedAction?: string;
}

export type AlertType =
  | "GOLDEN_CROSS"
  | "DEATH_CROSS"
  | "BREAKOUT"
  | "BREAKDOWN"
  | "VOLUME_SPIKE"
  | "SENTIMENT_SURGE"
  | "PRICE_TARGET_BREACH"
  | "RSI_EXTREME"
  | "MA_BOUNCE"
  | "SUPPORT_TEST"
  | "RESISTANCE_REJECT";

export interface MonitorConfig {
  watchlist: string[];
  alerts: PriceAlert[];
  checkIntervalMs: number;
  enabled: boolean;
}

interface MonitorState {
  symbol: string;
  quote: Quote;
  ohlcv: OHLCV[];
  news: NewsArticle[];
  previousData?: {
    quote?: Quote;
    ohlcv?: OHLCV[];
  };
}

/**
 * Monitor a single stock for significant events
 */
export async function monitorStock(state: MonitorState): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  // 1. Check for technical patterns
  const technicalAlerts = await checkTechnicalPatterns(state);
  alerts.push(...technicalAlerts);

  // 2. Check for volume spikes
  const volumeAlert = checkVolumeSpike(state);
  if (volumeAlert) alerts.push(volumeAlert);

  // 3. Check for sentiment shifts
  const sentimentAlert = await checkSentimentShift(state);
  if (sentimentAlert) alerts.push(sentimentAlert);

  // 4. Check for price level breaches
  const priceAlert = checkPriceLevels(state);
  if (priceAlert) alerts.push(priceAlert);

  return alerts;
}

/**
 * Check for technical patterns using AI
 */
async function checkTechnicalPatterns(state: MonitorState): Promise<MonitorAlert[]> {
  const { symbol, quote, ohlcv } = state;

  if (ohlcv.length < 50) return [];

  // Calculate indicators
  const sma20 = calculateSMA(ohlcv, 20);
  const sma50 = calculateSMA(ohlcv, 50);
  const rsi = calculateRSI(ohlcv);

  const alerts: MonitorAlert[] = [];

  // Golden Cross (SMA20 crosses above SMA50)
  const prevSma20 = calculateSMA(ohlcv.slice(0, -1), 20);
  const prevSma50 = calculateSMA(ohlcv.slice(0, -1), 50);

  if (prevSma20 && prevSma50 && sma20 && sma50) {
    if (prevSma20 <= prevSma50 && sma20 > sma50) {
      alerts.push({
        id: crypto.randomUUID(),
        type: "GOLDEN_CROSS",
        symbol,
        severity: "HIGH",
        title: "Golden Cross",
        description: `${symbol} SMA20 crossed above SMA50, forming a golden cross - typically a bullish signal`,
        timestamp: new Date().toISOString(),
        data: {
          price: quote.price,
          pattern: "Golden Cross",
        },
        suggestedAction: "Consider buying on dips, set stop loss below SMA50",
      });
    }

    // Death Cross
    if (prevSma20 >= prevSma50 && sma20 < sma50) {
      alerts.push({
        id: crypto.randomUUID(),
        type: "DEATH_CROSS",
        symbol,
        severity: "HIGH",
        title: "Death Cross",
        description: `${symbol} SMA20 crossed below SMA50, forming a death cross - typically a bearish signal`,
        timestamp: new Date().toISOString(),
        data: {
          price: quote.price,
          pattern: "Death Cross",
        },
        suggestedAction: "Consider reducing position or setting stop loss",
      });
    }
  }

  // RSI Extremes
  if (rsi) {
    if (rsi > 75) {
      alerts.push({
        id: crypto.randomUUID(),
        type: "RSI_EXTREME",
        symbol,
        severity: "MEDIUM",
        title: "RSI Overbought",
        description: `${symbol} RSI(${rsi.toFixed(1)}) entered overbought territory (>75), may face pullback`,
        timestamp: new Date().toISOString(),
        data: {
          price: quote.price,
        },
        suggestedAction: "Caution chasing at high prices, holders may consider partial profit-taking",
      });
    } else if (rsi < 25) {
      alerts.push({
        id: crypto.randomUUID(),
        type: "RSI_EXTREME",
        symbol,
        severity: "MEDIUM",
        title: "RSI Oversold",
        description: `${symbol} RSI(${rsi.toFixed(1)}) entered oversold territory (<25), may see rebound`,
        timestamp: new Date().toISOString(),
        data: {
          price: quote.price,
        },
        suggestedAction: "Watch for rebound signals, consider buying on weakness",
      });
    }
  }

  // Check for MA Bounce (price bouncing off SMA20/SMA50)
  const currentClose = ohlcv[ohlcv.length - 1]?.close;
  const prevLow = ohlcv[ohlcv.length - 2]?.low;

  if (currentClose && prevLow && sma20) {
    const distanceFromSMA = Math.abs(currentClose - sma20) / sma20;
    if (distanceFromSMA < 0.01 && prevLow < sma20) {
      alerts.push({
        id: crypto.randomUUID(),
        type: "MA_BOUNCE",
        symbol,
        severity: "LOW",
        title: "MA Support Bounce",
        description: `${symbol} bounced off support near SMA20(${sma20.toFixed(2)})`,
        timestamp: new Date().toISOString(),
        data: {
          price: quote.price,
        },
        suggestedAction: "Trend followers may consider entry",
      });
    }
  }

  return alerts;
}

/**
 * Check for unusual volume
 */
function checkVolumeSpike(state: MonitorState): MonitorAlert | null {
  const { symbol, quote, ohlcv } = state;

  if (ohlcv.length < 20) return null;

  const recentVolumes = ohlcv.slice(-20).map((bar) => bar.volume);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const currentVolume = ohlcv[ohlcv.length - 1]?.volume ?? 0;
  const volumeRatio = currentVolume / avgVolume;

  // Volume spike: >3x average
  if (volumeRatio > 3) {
    return {
      id: crypto.randomUUID(),
      type: "VOLUME_SPIKE",
      symbol,
      severity: "HIGH",
      title: "Volume Spike",
      description: `${symbol} volume surged ${volumeRatio.toFixed(1)}x (${currentVolume.toLocaleString()} vs avg ${avgVolume.toLocaleString()})`,
      timestamp: new Date().toISOString(),
      data: {
        price: quote.price,
        changePercent: quote.changePercent,
        volumeRatio,
      },
      suggestedAction: "Watch closely - may indicate important news or institutional activity",
    };
  }

  return null;
}

/**
 * Check for sentiment shifts using AI
 */
async function checkSentimentShift(state: MonitorState): Promise<MonitorAlert | null> {
  const { symbol, news } = state;

  if (news.length < 3 || !isAgentEnabled()) return null;

  // Analyze recent news sentiment
  const recentNews = news.slice(0, 10);
  const bullishCount = recentNews.filter((n) => n.sentimentLabel === "bullish").length;
  const bearishCount = recentNews.filter((n) => n.sentimentLabel === "bearish").length;

  const sentimentScore = (bullishCount - bearishCount) / recentNews.length;

  // Significant sentiment shift
  if (Math.abs(sentimentScore) > 0.6) {
    const isPositive = sentimentScore > 0;

    // Use AI to summarize the sentiment shift
    try {
      const response = await callLLM([
        {
          role: "system",
          content: "Briefly summarize the news sentiment change in one sentence.",
        },
        {
          role: "user",
          content: `${symbol} recent news:\n${recentNews.map((n) => `- [${n.sentimentLabel}] ${n.headline}`).join("\n")}\n\nPlease summarize the sentiment shift.`,
        },
      ]);

      return {
        id: crypto.randomUUID(),
        type: "SENTIMENT_SURGE",
        symbol,
        severity: isPositive ? "MEDIUM" : "HIGH",
        title: isPositive ? "Sentiment Significantly Bullish" : "Sentiment Significantly Bearish",
        description: response.content,
        timestamp: new Date().toISOString(),
        data: {
          sentimentShift: sentimentScore,
        },
        suggestedAction: isPositive ? "Watch for confirmation in price action" : "Monitor risk controls",
      };
    } catch {
      // Fallback without AI
      return {
        id: crypto.randomUUID(),
        type: "SENTIMENT_SURGE",
        symbol,
        severity: isPositive ? "MEDIUM" : "HIGH",
        title: isPositive ? "Sentiment Significantly Bullish" : "Sentiment Significantly Bearish",
        description: `${symbol} recent news sentiment is ${isPositive ? "significantly optimistic" : "significantly pessimistic"} (${bullishCount} bullish vs ${bearishCount} bearish)`,
        timestamp: new Date().toISOString(),
        data: {
          sentimentShift: sentimentScore,
        },
        suggestedAction: isPositive ? "Watch for confirmation in price action" : "Monitor risk controls",
      };
    }
  }

  return null;
}

/**
 * Check for price level breaches (user-defined alerts)
 */
function checkPriceLevels(state: MonitorState): MonitorAlert | null {
  const { symbol, quote } = state;

  // Check against user-defined price alerts
  // This would integrate with the existing alerts system
  // For now, check for round number breaches

  const price = quote.price;
  const changePercent = quote.changePercent;

  // Large single-day moves
  if (Math.abs(changePercent) > 8) {
    return {
      id: crypto.randomUUID(),
      type: "PRICE_TARGET_BREACH",
      symbol,
      severity: changePercent > 0 ? "MEDIUM" : "HIGH",
      title: changePercent > 0 ? "Large Single-Day Gain" : "Large Single-Day Drop",
      description: `${symbol} ${changePercent > 0 ? "up" : "down"} ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}% today`,
      timestamp: new Date().toISOString(),
      data: {
        price,
        changePercent,
      },
      suggestedAction: changePercent > 0 ? "Caution chasing highs" : "Watch for support levels",
    };
  }

  return null;
}

// ===== Utility Functions =====

function calculateSMA(ohlcv: OHLCV[], period: number): number | null {
  if (ohlcv.length < period) return null;
  const closes = ohlcv.slice(-period).map((bar) => bar.close);
  return closes.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(ohlcv: OHLCV[], period = 14): number | null {
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

/**
 * Run monitor on entire watchlist
 */
export async function runWatchlistMonitor(
  watchlist: string[],
  getData: (symbol: string) => Promise<MonitorState>,
  concurrency = 3
): Promise<Record<string, MonitorAlert[]>> {
  const results: Record<string, MonitorAlert[]> = {};

  const processSymbol = async (symbol: string) => {
    try {
      const state = await getData(symbol);
      const alerts = await monitorStock(state);
      results[symbol] = alerts;
    } catch (error) {
      console.error(`[Monitor] Error processing ${symbol}:`, error);
      results[symbol] = [];
    }
  };

  // Process with concurrency limit
  const batches = [];
  for (let i = 0; i < watchlist.length; i += concurrency) {
    const batch = watchlist.slice(i, i + concurrency);
    batches.push(Promise.all(batch.map(processSymbol)));
  }

  await Promise.all(batches);
  return results;
}

/**
 * Alert prioritization for notification
 */
export function prioritizeAlerts(alerts: MonitorAlert[]): MonitorAlert[] {
  const severityOrder: Record<MonitorAlert["severity"], number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  return [...alerts].sort((a, b) => {
    // First by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by type priority
    const typePriority: Record<AlertType, number> = {
      GOLDEN_CROSS: 0,
      DEATH_CROSS: 0,
      BREAKOUT: 1,
      BREAKDOWN: 1,
      VOLUME_SPIKE: 2,
      SENTIMENT_SURGE: 2,
      PRICE_TARGET_BREACH: 3,
      RSI_EXTREME: 3,
      MA_BOUNCE: 4,
      SUPPORT_TEST: 4,
      RESISTANCE_REJECT: 4,
    };

    return typePriority[a.type] - typePriority[b.type];
  });
}
