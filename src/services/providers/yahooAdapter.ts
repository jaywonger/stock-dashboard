import type { MarketStatus, OHLCV, Quote, SearchResult, StockDataProvider, Timeframe } from "../../types";

const intervalByTimeframe: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "1h",
  "1D": "1d",
  "1W": "1wk",
  "1M": "1mo"
};

const rangeByTimeframe: Record<Timeframe, string> = {
  "1m": "7d",
  "5m": "30d",
  "15m": "60d",
  "1h": "6mo",
  "4h": "1y",
  "1D": "2y",
  "1W": "5y",
  "1M": "10y"
};

export class YahooAdapter implements StockDataProvider {
  id = "yahoo" as const;

  private async chartPayload(ticker: string, timeframe: Timeframe) {
    const symbol = ticker.toUpperCase();
    const interval = intervalByTimeframe[timeframe];
    const range = rangeByTimeframe[timeframe];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Yahoo request failed: ${response.status}`);
    return (await response.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
          meta?: {
            regularMarketPrice?: number;
            previousClose?: number;
            longName?: string;
          };
        }>;
      };
    };
  }

  async getQuote(ticker: string): Promise<Quote> {
    const payload = await this.chartPayload(ticker, "1D");
    const result = payload.chart?.result?.[0];
    if (!result?.meta) throw new Error("Yahoo quote unavailable");
    const price = result.meta.regularMarketPrice ?? 0;
    const prev = result.meta.previousClose ?? price;
    const change = price - prev;
    const changePercent = prev === 0 ? 0 : (change / prev) * 100;
    return {
      symbol: ticker.toUpperCase(),
      companyName: result.meta.longName ?? ticker.toUpperCase(),
      price,
      change,
      changePercent,
      timestamp: new Date().toISOString()
    };
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const payload = await this.chartPayload(ticker, timeframe);
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    if (!quote) return [];
    return timestamps
      .map((timestamp, index) => {
        const open = quote.open?.[index];
        const high = quote.high?.[index];
        const low = quote.low?.[index];
        const close = quote.close?.[index];
        const volume = quote.volume?.[index] ?? 0;
        if ([open, high, low, close].some((value) => value === null || value === undefined)) return null;
        return {
          time: new Date(timestamp * 1000).toISOString(),
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume)
        } satisfies OHLCV;
      })
      .filter((item): item is OHLCV => Boolean(item))
      .filter((item) => {
        const ts = new Date(item.time).getTime();
        return ts >= from.getTime() && ts <= to.getTime();
      });
  }

  async search(query: string): Promise<SearchResult[]> {
    const q = encodeURIComponent(query);
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${q}&quotesCount=8&newsCount=0`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Yahoo search failed: ${response.status}`);
    const payload = (await response.json()) as {
      quotes?: Array<{ symbol: string; shortname?: string; exchange?: string }>;
    };
    return (
      payload.quotes?.map((item) => ({
        symbol: item.symbol,
        name: item.shortname ?? item.symbol,
        exchange: item.exchange
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
