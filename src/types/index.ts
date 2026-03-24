export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "1M";
export type ChartType = "candlestick" | "line" | "area" | "bar";
export type SentimentLabel = "bullish" | "neutral" | "bearish";
export type MarketSession = "PRE" | "OPEN" | "AFTER" | "CLOSED";
export type SortDirection = "asc" | "desc";

export interface Quote {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: string;
}

export interface OHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

export interface MarketStatus {
  isOpen: boolean;
  session: MarketSession;
  nextOpen?: string;
  nextClose?: string;
}

export interface PriceAlert {
  id: number;
  symbol: string;
  targetPrice: number;
  direction: "above" | "below";
  status: "active" | "triggered" | "dismissed";
  createdAt: string;
  triggeredAt?: string;
}

export interface WatchlistItem {
  symbol: string;
  companyName: string;
  price?: number;
  changePercent?: number;
  sparkline?: number[];
}

export interface Watchlist {
  id: number;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface IndicatorInput {
  period?: number;
  signalPeriod?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  stdDev?: number;
}

export interface IndicatorSeriesPoint {
  time: string;
  value: number | null;
}

export interface MACDPoint {
  time: string;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerPoint {
  time: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
  percentB: number | null;
}

export interface IchimokuPoint {
  time: string;
  tenkanSen: number | null;
  kijunSen: number | null;
  senkouSpanA: number | null;
  senkouSpanB: number | null;
  chikouSpan: number | null;
}

export type ScreenerOperator = ">" | "<" | "=" | "crosses above" | "crosses below" | "between";
export type LogicalJoin = "AND" | "OR";

export interface BasicScreenerFilters {
  exchange: "NYSE" | "NASDAQ" | "AMEX" | "TSX" | "B3" | "LSE" | "OTC" | "All";
  marketCapRange: {
    min: number | null;
    max: number | null;
  };
  sectors: string[];
  priceMin: number | null;
  priceMax: number | null;
  minAverageVolume30d: number | null;
}

export type TechnicalIndicatorName =
  | "RSI"
  | "MACD Signal"
  | "EMA(20)"
  | "EMA(50)"
  | "SMA(200)"
  | "Price vs VWAP"
  | "ATR"
  | "Volume vs Avg Volume"
  | "Bollinger %B"
  | "Distance from 52W High/Low";

export interface TechnicalCondition {
  id: string;
  indicator: TechnicalIndicatorName;
  operator: ScreenerOperator;
  value: number | [number, number];
}

export interface ScreenerConfig {
  basic: BasicScreenerFilters;
  technicalConditions: TechnicalCondition[];
  technicalJoin: LogicalJoin;
}

export interface ScreenerPreset {
  id: number;
  name: string;
  config: ScreenerConfig;
  createdAt: string;
}

export interface ScreenerRow {
  symbol: string;
  company: string;
  price: number;
  changePercent: number;
  volume: number;
  relativeVolume: number;
  rsi: number | null;
  macd: number | null;
  activeSignals: string[];
  sector: string;
  marketCap: number;
  sparkline: number[];
}

export interface ProviderPriority {
  id: StockProviderId;
  enabled: boolean;
}

export type StockProviderId = "polygon" | "alphaVantage" | "finnhub" | "yahoo" | "mock";

export interface ProviderKeys {
  polygonApiKey?: string;
  alphaVantageApiKey?: string;
  finnhubApiKey?: string;
  newsApiKey?: string;
  benzingaApiKey?: string;
  fredApiKey?: string;
  rssFeedUrls?: string[];
  litellmModel?: string;
  litellmApiKey?: string;
  litellmBaseUrl?: string;
  geminiApiKey?: string;
  claudeApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
}

export interface RefreshIntervals {
  marketData: number;
  news: number;
  screener: number;
}

export interface IndicatorDefaults {
  rsiPeriod: number;
  smaPeriods: number[];
  emaPeriods: number[];
  bollingerPeriod: number;
  bollingerStdDev: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export interface SettingsState {
  providerPriority: ProviderPriority[];
  refreshIntervals: RefreshIntervals;
  indicatorDefaults: IndicatorDefaults;
  notificationEnabled: boolean;
  keys: ProviderKeys;
}

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  ticker?: string;
  summary?: string;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
}

export interface NewsSourceResult {
  source: string;
  articles: NewsArticle[];
}

export interface TickerSentiment {
  symbol: string;
  score: number;
  bullishCount: number;
  bearishCount: number;
}

export interface SentimentSummary {
  overallScore: number;
  topBullish: TickerSentiment[];
  topBearish: TickerSentiment[];
  trend: Array<{ date: string; score: number }>;
}

export interface StockDataProvider {
  id: StockProviderId;
  getQuote(ticker: string): Promise<Quote>;
  getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]>;
  search(query: string): Promise<SearchResult[]>;
  getMarketStatus(): Promise<MarketStatus>;
}

export type DecisionAction = "buy" | "hold" | "sell";
export type ChecklistStatus = "pass" | "watch" | "fail";

export interface DecisionChecklistItem {
  label: string;
  status: ChecklistStatus;
  detail: string;
}

export interface DailyDecisionDashboard {
  ticker: string;
  timeframe: Timeframe;
  generatedAt: string;
  conclusion: string;
  action: DecisionAction;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  price: number;
  changePercent: number;
  levels: {
    entryMin: number;
    entryMax: number;
    stopLoss: number;
    target1: number;
    target2: number;
  };
  indicators: {
    rsi14: number | null;
    macdHistogram: number | null;
    sma20: number | null;
    sma50: number | null;
  };
  sentiment: {
    overallScore: number;
    articleCount: number;
  };
  checklist: DecisionChecklistItem[];
  aiCommentary?: string;
  aiProvider?: string;
}

export type AnalystRole = "market-analyst" | "sentiment-analyst" | "news-analyst" | "fundamentals-analyst";
export type AnalystStance = "bullish" | "neutral" | "bearish";

export interface AnalystView {
  role: AnalystRole;
  stance: AnalystStance;
  confidence: number;
  reasoning: string;
}

export interface DebateRound {
  round: number;
  summary: string;
  analysts: AnalystView[];
}

export interface NewsTeamAnalysisReport {
  ticker: string;
  timeframe: Timeframe;
  analysisDate: string;
  rounds: number;
  team: AnalystView[];
  debate: DebateRound[];
  finalVerdict: {
    stance: AnalystStance;
    confidence: number;
    rationale: string;
  };
}

// AI Agent Types
export type Recommendation = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export type Trend = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Momentum = "STRONG_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "STRONG_NEGATIVE";
export type RSILevel = "OVERBOUGHT" | "BULLISH" | "NEUTRAL" | "BEARISH" | "OVERSOLD";

export interface StockAnalysis {
  symbol: string;
  timestamp: string;
  recommendation: Recommendation;
  confidence: number;
  summary: string;
  entryPrice: { low: number; high: number };
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: number;
  technicalAnalysis: {
    trend: Trend;
    momentum: Momentum;
    support: number[];
    resistance: number[];
    maAlignment: "BULLISH" | "BEARISH" | "MIXED";
    rsiLevel: RSILevel;
  };
  sentimentAnalysis: {
    overall: "BULLISH" | "NEUTRAL" | "BEARISH";
    score: number;
    recentNewsSummary: string;
  };
  checklist: {
    item: string;
    status: "Met" | "Caution" | "Not Met";
    note?: string;
  }[];
  risks: string[];
  catalysts: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    symbolsMentioned?: string[];
    suggestedActions?: ChatSuggestedAction[];
  };
}

export interface ChatSuggestedAction {
  type: "view_chart" | "set_alert" | "add_watchlist" | "run_screener";
  label: string;
  payload?: Record<string, unknown>;
}

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

export interface AgentStatus {
  enabled: boolean;
  model: string;
  hasApiKey: boolean;
}
