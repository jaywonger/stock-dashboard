export const FINANCIAL_SENTIMENT_LEXICON: Record<string, number> = {
  bullish: 2.1,
  bullishness: 1.7,
  breakout: 1.8,
  surge: 1.7,
  jump: 1.2,
  jumps: 1.2,
  gains: 1.2,
  gain: 1.1,
  record: 1.1,
  highs: 1.0,
  beats: 1.5,
  beat: 1.4,
  growth: 1.2,
  rises: 1.0,
  rise: 1.0,
  upside: 1.1,
  optimistic: 1.3,
  rally: 1.6,
  outperform: 1.7,
  upgrade: 1.5,
  upgraded: 1.5,
  strong: 1.1,
  strength: 1.0,
  buyback: 1.2,
  dividend: 0.9,
  guidance: 1.0,
  rebound: 1.3,
  resilient: 1.0,
  tailwind: 1.1,
  crash: -2.4,
  falls: -1.0,
  fall: -1.0,
  declines: -1.2,
  decline: -1.1,
  drops: -1.1,
  drop: -1.0,
  losses: -1.2,
  loss: -1.1,
  miss: -1.7,
  misses: -1.7,
  downgrade: -1.8,
  downgraded: -1.8,
  recall: -1.5,
  investigation: -1.8,
  lawsuit: -1.4,
  tariff: -1.0,
  tariffs: -1.1,
  recession: -1.8,
  slowdown: -1.2,
  inflation: -0.8,
  uncertainty: -1.0,
  pessimistic: -1.3,
  plunge: -2.1,
  fraud: -2.5,
  weak: -1.0,
  warning: -1.1,
  selloff: -1.7,
  bankruptcy: -2.6,
  default: -2.2,
  volatility: -0.8
};

export interface LexiconSentimentResult {
  score: number;
  label: "bullish" | "neutral" | "bearish";
}

export const scoreTextSentiment = (text: string): LexiconSentimentResult => {
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  const tokenScores = tokens.map((token) => FINANCIAL_SENTIMENT_LEXICON[token] ?? 0);
  const raw = tokenScores.reduce((sum, score) => sum + score, 0);
  // Use sqrt-length normalization so longer summaries don't wash out signal to neutral.
  const normalized = Math.max(-1, Math.min(1, raw / Math.max(Math.sqrt(tokens.length) + 1, 1)));
  if (normalized > 0.08) return { score: normalized, label: "bullish" };
  if (normalized < -0.08) return { score: normalized, label: "bearish" };
  return { score: normalized, label: "neutral" };
};
