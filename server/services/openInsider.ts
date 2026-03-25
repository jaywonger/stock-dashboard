export type InsiderSignal = "bullish" | "bearish" | "neutral";

export interface OpenInsiderSummary {
  ticker: string;
  tradesFound: number;
  buyCount: number;
  sellCount: number;
  buyValue: number;
  sellValue: number;
  netValue: number;
  signal: InsiderSignal;
  confidence: number;
  summary: string;
  sourceUrl: string;
  asOf: string;
}

const isOpenInsiderDebugEnabled = (): boolean => (process.env.OPENINSIDER_DEBUG ?? "false").toLowerCase() === "true";
const openInsiderDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isOpenInsiderDebugEnabled()) return;
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  // eslint-disable-next-line no-console
  console.log(`[openinsider] ${message}${suffix}`);
};

interface ParsedTrade {
  tradeType: string;
  value: number;
}

const decodeHtml = (input: string): string =>
  input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const stripTags = (input: string): string => decodeHtml(input.replace(/<[^>]*>/g, " "));

const parseNumber = (input: string): number => {
  const cleaned = input.replace(/[$,%+\s]/g, "").replace(/,/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
};

const parseTradesFromHtml = (html: string): ParsedTrade[] => {
  const tableMatch = html.match(/<table[^>]*class="[^"]*tinytable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  const scope = tableMatch?.[1] ?? html;
  const trades: ParsedTrade[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null = null;
  while ((rowMatch = rowRegex.exec(scope)) !== null) {
    const row = rowMatch[1];
    if (/<th[\s>]/i.test(row)) continue;
    const cols = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((match) => stripTags(match[1]));
    if (cols.length < 12) continue;
    const tradeType = cols[6] ?? "";
    const valueFromTable = parseNumber(cols[11] ?? "");
    const price = parseNumber(cols[7] ?? "");
    const qty = parseNumber(cols[8] ?? "");
    const computedValue = price > 0 && qty > 0 ? price * qty : 0;
    const value = valueFromTable > 0 ? valueFromTable : computedValue;
    if (!tradeType || value <= 0) continue;
    trades.push({ tradeType, value });
  }
  return trades;
};

const buildSummary = (ticker: string, trades: ParsedTrade[], sourceUrl: string): OpenInsiderSummary | undefined => {
  if (trades.length === 0) return undefined;

  let buyCount = 0;
  let sellCount = 0;
  let buyValue = 0;
  let sellValue = 0;

  for (const trade of trades) {
    const type = trade.tradeType.toLowerCase();
    if (type.includes("purchase") || /^p\b/.test(type)) {
      buyCount += 1;
      buyValue += trade.value;
      continue;
    }
    if (type.includes("sale") || /^s\b/.test(type)) {
      sellCount += 1;
      sellValue += trade.value;
    }
  }

  const netValue = buyValue - sellValue;
  const grossValue = buyValue + sellValue;
  const netRatio = grossValue > 0 ? netValue / grossValue : 0;
  const signal: InsiderSignal = netRatio > 0.25 ? "bullish" : netRatio < -0.25 ? "bearish" : "neutral";
  const confidence = Math.min(95, Math.max(50, Math.round(55 + Math.abs(netRatio) * 35 + Math.min(trades.length, 20))));

  return {
    ticker,
    tradesFound: trades.length,
    buyCount,
    sellCount,
    buyValue: Math.round(buyValue),
    sellValue: Math.round(sellValue),
    netValue: Math.round(netValue),
    signal,
    confidence,
    summary: `${ticker} insider activity (${trades.length} filings): buys ${buyCount} ($${Math.round(
      buyValue
    ).toLocaleString()}), sells ${sellCount} ($${Math.round(sellValue).toLocaleString()}), net $${Math.round(netValue).toLocaleString()}.`,
    sourceUrl,
    asOf: new Date().toISOString()
  };
};

export async function fetchOpenInsiderSummary(ticker: string): Promise<OpenInsiderSummary | undefined> {
  const enabled = (process.env.OPENINSIDER_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled || !ticker) return undefined;

  const timeoutMs = Number(process.env.OPENINSIDER_TIMEOUT_MS ?? 8_000);
  const days = Math.max(1, Number(process.env.OPENINSIDER_LOOKBACK_DAYS ?? 30));
  const safeTicker = encodeURIComponent(ticker.toUpperCase());
  const sourceUrls = [
    `https://openinsider.com/screener?s=${safeTicker}&fd=${days}&td=0&xp=1&xs=1`,
    `http://openinsider.com/screener?s=${safeTicker}&fd=${days}&td=0&xp=1&xs=1`
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (const sourceUrl of sourceUrls) {
      openInsiderDebug("fetch:start", { ticker: ticker.toUpperCase(), sourceUrl });
      const response = await fetch(sourceUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      if (!response.ok) {
        openInsiderDebug("fetch:non_ok", { sourceUrl, status: response.status, statusText: response.statusText });
        continue;
      }
      const html = await response.text();
      openInsiderDebug("fetch:ok", { sourceUrl, htmlLength: html.length });
      const trades = parseTradesFromHtml(html);
      openInsiderDebug("parse:rows", { sourceUrl, tradesFound: trades.length });
      const summary = buildSummary(ticker.toUpperCase(), trades, sourceUrl);
      if (summary) {
        openInsiderDebug("summary:built", {
          ticker: summary.ticker,
          signal: summary.signal,
          tradesFound: summary.tradesFound,
          netValue: summary.netValue,
          sourceUrl
        });
        return summary;
      }
      openInsiderDebug("summary:empty", { sourceUrl, ticker: ticker.toUpperCase() });
    }
    openInsiderDebug("fetch:all_sources_exhausted", { ticker: ticker.toUpperCase() });
    return undefined;
  } catch (error) {
    openInsiderDebug("fetch:error", {
      ticker: ticker.toUpperCase(),
      message: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
