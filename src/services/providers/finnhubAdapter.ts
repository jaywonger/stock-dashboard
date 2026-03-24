import type { MarketStatus, OHLCV, Quote, SearchResult, StockDataProvider, Timeframe } from "../../types";
import { throttleProvider } from "../rateLimit";

const resolutionForTimeframe = (timeframe: Timeframe): string => {
  switch (timeframe) {
    case "1m":
      return "1";
    case "5m":
      return "5";
    case "15m":
      return "15";
    case "1h":
      return "60";
    case "4h":
      return "240";
    case "1W":
      return "W";
    case "1M":
      return "M";
    case "1D":
    default:
      return "D";
  }
};

export class FinnhubAdapter implements StockDataProvider {
  id = "finnhub" as const;
  private apiKey: string;
  private requestTimeoutMs = Number(process.env.PROVIDER_HTTP_TIMEOUT_MS ?? 12_000);
  private static profileCache = new Map<string, { name: string; expiresAt: number }>();
  private static profileInflight = new Map<string, Promise<string>>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getJson<T>(url: string): Promise<T> {
    await throttleProvider("finnhub", 60);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!response.ok) throw new Error(`Finnhub request failed: ${response.status}`);
    return (await response.json()) as T;
  }

  private async getCompanyName(symbol: string): Promise<string> {
    const now = Date.now();
    const cached = FinnhubAdapter.profileCache.get(symbol);
    if (cached && cached.expiresAt > now) return cached.name;

    const existing = FinnhubAdapter.profileInflight.get(symbol);
    if (existing) return existing;

    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.apiKey}`;
    const task = this.getJson<{ name?: string }>(profileUrl)
      .then((profile) => {
        const name = profile.name?.trim() || symbol;
        FinnhubAdapter.profileCache.set(symbol, { name, expiresAt: now + 24 * 60 * 60_000 });
        return name;
      })
      .catch(() => symbol)
      .finally(() => {
        FinnhubAdapter.profileInflight.delete(symbol);
      });

    FinnhubAdapter.profileInflight.set(symbol, task);
    return task;
  }

  async getQuote(ticker: string): Promise<Quote> {
    const symbol = ticker.toUpperCase();
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.apiKey}`;
    const [quote, companyName] = await Promise.all([
      this.getJson<{ c: number; d: number; dp: number; v?: number; t: number }>(quoteUrl),
      this.getCompanyName(symbol)
    ]);
    return {
      symbol,
      companyName,
      price: quote.c ?? 0,
      change: quote.d ?? 0,
      changePercent: quote.dp ?? 0,
      volume: quote.v ?? 0,
      timestamp: quote.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString()
    };
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const symbol = ticker.toUpperCase();
    const resolution = resolutionForTimeframe(timeframe);
    const url =
      `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}` +
      `&from=${Math.floor(from.getTime() / 1000)}&to=${Math.floor(to.getTime() / 1000)}&token=${this.apiKey}`;
    const payload = await this.getJson<{
      c?: number[];
      h?: number[];
      l?: number[];
      o?: number[];
      t?: number[];
      v?: number[];
      s?: string;
    }>(url);
    if (payload.s !== "ok" || !payload.t || !payload.c || !payload.o || !payload.h || !payload.l || !payload.v) return [];

    return payload.t.map((time, index) => ({
      time: new Date(time * 1000).toISOString(),
      open: payload.o![index],
      high: payload.h![index],
      low: payload.l![index],
      close: payload.c![index],
      volume: payload.v![index]
    }));
  }

  async search(query: string): Promise<SearchResult[]> {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`;
    const payload = await this.getJson<{ result?: Array<{ symbol: string; description: string }> }>(url);
    return (
      payload.result?.slice(0, 10).map((row) => ({
        symbol: row.symbol,
        name: row.description
      })) ?? []
    );
  }

  async getMarketStatus(): Promise<MarketStatus> {
    const now = new Date();
    const day = now.getUTCDay();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const open = 13 * 60 + 30;
    const close = 20 * 60;
    const isWeekday = day > 0 && day < 6;
    const isOpen = isWeekday && minutes >= open && minutes <= close;
    return {
      isOpen,
      session: !isWeekday ? "CLOSED" : isOpen ? "OPEN" : minutes < open ? "PRE" : "AFTER"
    };
  }
}
