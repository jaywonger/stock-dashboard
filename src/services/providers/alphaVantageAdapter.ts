import type { MarketStatus, OHLCV, Quote, SearchResult, StockDataProvider, Timeframe } from "../../types";

const seriesKeyForTimeframe = (timeframe: Timeframe): string => {
  switch (timeframe) {
    case "1m":
    case "5m":
    case "15m":
    case "1h":
    case "4h":
      return "Time Series (15min)";
    case "1W":
      return "Weekly Time Series";
    case "1M":
      return "Monthly Time Series";
    case "1D":
    default:
      return "Time Series (Daily)";
  }
};

const functionForTimeframe = (timeframe: Timeframe): string => {
  switch (timeframe) {
    case "1m":
    case "5m":
    case "15m":
    case "1h":
    case "4h":
      return "TIME_SERIES_INTRADAY";
    case "1W":
      return "TIME_SERIES_WEEKLY";
    case "1M":
      return "TIME_SERIES_MONTHLY";
    case "1D":
    default:
      return "TIME_SERIES_DAILY";
  }
};

export class AlphaVantageAdapter implements StockDataProvider {
  id = "alphaVantage" as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Alpha Vantage request failed: ${response.status}`);
    return (await response.json()) as T;
  }

  async getQuote(ticker: string): Promise<Quote> {
    const symbol = ticker.toUpperCase();
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
    const payload = await this.getJson<{ "Global Quote"?: Record<string, string> }>(url);
    const row = payload["Global Quote"];
    if (!row) throw new Error("Alpha Vantage quote unavailable");
    const price = Number(row["05. price"] ?? 0);
    const change = Number(row["09. change"] ?? 0);
    const changePercent = Number(String(row["10. change percent"] ?? "0").replace("%", ""));
    return {
      symbol,
      companyName: symbol,
      price,
      change,
      changePercent,
      volume: Number(row["06. volume"] ?? 0),
      timestamp: new Date().toISOString()
    };
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const symbol = ticker.toUpperCase();
    const fn = functionForTimeframe(timeframe);
    const interval = fn === "TIME_SERIES_INTRADAY" ? "&interval=15min&outputsize=full" : "";
    const url = `https://www.alphavantage.co/query?function=${fn}&symbol=${symbol}${interval}&apikey=${this.apiKey}`;
    const payload = await this.getJson<Record<string, Record<string, Record<string, string>>>>(url);
    const key = seriesKeyForTimeframe(timeframe);
    const series = payload[key];
    if (!series) return [];

    return Object.entries(series)
      .map(([time, row]) => ({
        time: new Date(time).toISOString(),
        open: Number(row["1. open"]),
        high: Number(row["2. high"]),
        low: Number(row["3. low"]),
        close: Number(row["4. close"]),
        volume: Number(row["5. volume"] ?? 0)
      }))
      .filter((row) => {
        const ts = new Date(row.time).getTime();
        return ts >= from.getTime() && ts <= to.getTime();
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  async search(query: string): Promise<SearchResult[]> {
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.apiKey}`;
    const payload = await this.getJson<{ bestMatches?: Array<Record<string, string>> }>(url);
    return (
      payload.bestMatches?.map((row) => ({
        symbol: row["1. symbol"],
        name: row["2. name"],
        exchange: row["4. region"]
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
