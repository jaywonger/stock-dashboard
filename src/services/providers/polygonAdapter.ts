import type { MarketStatus, OHLCV, Quote, SearchResult, StockDataProvider, Timeframe } from "../../types";
import { throttleProvider } from "../rateLimit";

const timeframeToPolygon = (timeframe: Timeframe): { multiplier: number; timespan: string } => {
  switch (timeframe) {
    case "1m":
      return { multiplier: 1, timespan: "minute" };
    case "5m":
      return { multiplier: 5, timespan: "minute" };
    case "15m":
      return { multiplier: 15, timespan: "minute" };
    case "1h":
      return { multiplier: 1, timespan: "hour" };
    case "4h":
      return { multiplier: 4, timespan: "hour" };
    case "1D":
      return { multiplier: 1, timespan: "day" };
    case "1W":
      return { multiplier: 1, timespan: "week" };
    case "1M":
      return { multiplier: 1, timespan: "month" };
    default:
      return { multiplier: 1, timespan: "day" };
  }
};

const ensure = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

export class PolygonAdapter implements StockDataProvider {
  id = "polygon" as const;
  private apiKey: string;
  private requestTimeoutMs = Number(process.env.PROVIDER_HTTP_TIMEOUT_MS ?? 12_000);

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getJson<T>(url: string): Promise<T> {
    await throttleProvider("polygon", 5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!response.ok) {
      throw new Error(`Polygon request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getQuote(ticker: string): Promise<Quote> {
    const symbol = ticker.toUpperCase();
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${this.apiKey}`;
    const payload = await this.getJson<{
      ticker?: {
        ticker: string;
        name?: string;
        day?: { c: number };
        prevDay?: { c: number };
        lastTrade?: { p: number };
        todaysChange?: number;
        todaysChangePerc?: number;
        dayVolume?: number;
        updated?: number;
      };
    }>(url);
    ensure(payload.ticker, "Missing Polygon ticker payload");
    const last = payload.ticker?.lastTrade?.p ?? payload.ticker?.day?.c ?? payload.ticker?.prevDay?.c ?? 0;
    const change = payload.ticker?.todaysChange ?? 0;
    const changePercent = payload.ticker?.todaysChangePerc ?? 0;
    return {
      symbol,
      companyName: payload.ticker?.name ?? symbol,
      price: last,
      change,
      changePercent,
      volume: payload.ticker?.dayVolume ?? 0,
      timestamp: payload.ticker?.updated ? new Date(payload.ticker.updated).toISOString() : new Date().toISOString()
    };
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const symbol = ticker.toUpperCase();
    const tf = timeframeToPolygon(timeframe);
    const url =
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${tf.multiplier}/${tf.timespan}/${from.toISOString().slice(0, 10)}/${to.toISOString().slice(0, 10)}` +
      `?adjusted=true&sort=asc&limit=5000&apiKey=${this.apiKey}`;
    const payload = await this.getJson<{ results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> }>(
      url
    );
    return (
      payload.results?.map((row) => ({
        time: new Date(row.t).toISOString(),
        open: row.o,
        high: row.h,
        low: row.l,
        close: row.c,
        volume: row.v
      })) ?? []
    );
  }

  async search(query: string): Promise<SearchResult[]> {
    const url =
      `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&market=stocks&active=true&limit=10&apiKey=${this.apiKey}`;
    const payload = await this.getJson<{
      results?: Array<{ ticker: string; name: string; primary_exchange?: string }>;
    }>(url);
    return (
      payload.results?.map((row) => ({
        symbol: row.ticker,
        name: row.name,
        exchange: row.primary_exchange
      })) ?? []
    );
  }

  async getMarketStatus(): Promise<MarketStatus> {
    const url = `https://api.polygon.io/v1/marketstatus/now?apiKey=${this.apiKey}`;
    const payload = await this.getJson<{ market?: string; serverTime?: string; afterHours?: boolean; currencies?: { fx?: string } }>(url);
    const market = payload.market?.toLowerCase();
    return {
      isOpen: market === "open",
      session: market === "open" ? "OPEN" : payload.afterHours ? "AFTER" : "CLOSED",
      nextOpen: payload.serverTime
    };
  }
}
