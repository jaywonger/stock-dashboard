import type { MarketStatus, OHLCV, Quote, SearchResult, StockDataProvider, Timeframe } from "../../types";

const COMPANIES: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF Trust",
  QQQ: "Invesco QQQ Trust",
  DIA: "SPDR Dow Jones Industrial Average ETF",
  IWM: "iShares Russell 2000 ETF",
  VIX: "CBOE Volatility Index",
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  TSLA: "Tesla, Inc.",
  NVDA: "NVIDIA Corporation",
  AMZN: "Amazon.com, Inc."
};

const randomFromSymbol = (symbol: string): number => {
  let hash = 0;
  for (const ch of symbol) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return hash / 100000;
};

const nowIso = () => new Date().toISOString();

const timeframeMinutes: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1D": 60 * 24,
  "1W": 60 * 24 * 7,
  "1M": 60 * 24 * 30
};

export class MockAdapter implements StockDataProvider {
  id = "mock" as const;

  async getQuote(ticker: string): Promise<Quote> {
    const seed = randomFromSymbol(ticker.toUpperCase());
    const base = 40 + seed * 400;
    const wave = Math.sin(Date.now() / 120000 + seed * 12) * 2.8;
    const price = Number((base + wave).toFixed(2));
    const change = Number((Math.sin(Date.now() / 400000 + seed * 5) * 3.1).toFixed(2));
    const changePercent = Number(((change / Math.max(base, 1)) * 100).toFixed(2));
    return {
      symbol: ticker.toUpperCase(),
      companyName: COMPANIES[ticker.toUpperCase()] ?? `${ticker.toUpperCase()} Holdings`,
      price,
      change,
      changePercent,
      volume: Math.floor(1_000_000 + seed * 40_000_000),
      timestamp: nowIso()
    };
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const seed = randomFromSymbol(ticker.toUpperCase());
    const stepMinutes = timeframeMinutes[timeframe];
    const totalSteps = Math.max(30, Math.floor((to.getTime() - from.getTime()) / (stepMinutes * 60_000)));
    const bars: OHLCV[] = [];
    let prevClose = 60 + seed * 300;
    for (let i = 0; i <= totalSteps; i += 1) {
      const time = new Date(from.getTime() + i * stepMinutes * 60_000);
      const drift = Math.sin(i / 12 + seed * 10) * 1.2 + Math.cos(i / 9 + seed * 4) * 0.7;
      const open = prevClose;
      const close = Math.max(1, open + drift);
      const high = Math.max(open, close) + 0.8 + (i % 4) * 0.12;
      const low = Math.min(open, close) - 0.7 - (i % 3) * 0.11;
      const volume = Math.floor(250_000 + seed * 1_500_000 + (Math.sin(i / 5) + 1.3) * 80_000);
      bars.push({ time: time.toISOString(), open, high, low, close, volume });
      prevClose = close;
    }
    return bars;
  }

  async search(query: string): Promise<SearchResult[]> {
    const q = query.toUpperCase().trim();
    const symbols = Object.keys(COMPANIES);
    return symbols
      .filter((symbol) => symbol.includes(q) || COMPANIES[symbol].toUpperCase().includes(q))
      .slice(0, 10)
      .map((symbol) => ({
        symbol,
        name: COMPANIES[symbol],
        exchange: "NASDAQ"
      }));
  }

  async getMarketStatus(): Promise<MarketStatus> {
    const now = new Date();
    const day = now.getUTCDay();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;
    const openMinutes = 13 * 60 + 30;
    const closeMinutes = 20 * 60;
    const isWeekday = day >= 1 && day <= 5;
    const isOpen = isWeekday && totalMinutes >= openMinutes && totalMinutes <= closeMinutes;
    return {
      isOpen,
      session: !isWeekday ? "CLOSED" : isOpen ? "OPEN" : totalMinutes < openMinutes ? "PRE" : "AFTER"
    };
  }
}
