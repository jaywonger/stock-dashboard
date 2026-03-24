import type {
  MarketStatus,
  OHLCV,
  Quote,
  SearchResult,
  StockDataProvider,
  StockProviderId,
  Timeframe
} from "../types";
import { AlphaVantageAdapter } from "./providers/alphaVantageAdapter";
import { FinnhubAdapter } from "./providers/finnhubAdapter";
import { MockAdapter } from "./providers/mockAdapter";
import { PolygonAdapter } from "./providers/polygonAdapter";
import { YahooAdapter } from "./providers/yahooAdapter";

interface ProviderKeys {
  polygonApiKey?: string;
  alphaVantageApiKey?: string;
  finnhubApiKey?: string;
}

/**
 * Stock data service for the frontend. Uses backend API routes with a mock fallback.
 */
export class HttpStockDataService implements StockDataProvider {
  id = "mock" as const;
  private baseUrl: string;
  private mock = new MockAdapter();

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP stock request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getQuote(ticker: string): Promise<Quote> {
    try {
      return await this.getJson<Quote>(`${this.baseUrl}/quotes/${ticker.toUpperCase()}`);
    } catch {
      return this.mock.getQuote(ticker);
    }
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const params = new URLSearchParams({
      timeframe,
      from: from.toISOString(),
      to: to.toISOString()
    });
    try {
      return await this.getJson<OHLCV[]>(`${this.baseUrl}/ohlcv/${ticker.toUpperCase()}?${params}`);
    } catch {
      return this.mock.getOHLCV(ticker, timeframe, from, to);
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    try {
      return await this.getJson<SearchResult[]>(`${this.baseUrl}/quotes/search?q=${encodeURIComponent(query)}`);
    } catch {
      return this.mock.search(query);
    }
  }

  async getMarketStatus(): Promise<MarketStatus> {
    try {
      return await this.getJson<MarketStatus>(`${this.baseUrl}/quotes/market-status`);
    } catch {
      return this.mock.getMarketStatus();
    }
  }
}

/**
 * Provider fallback service used by backend routes.
 */
export class FallbackStockDataService implements StockDataProvider {
  id = "mock" as const;
  private providerTimeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 10_000);
  constructor(private providers: StockDataProvider[]) {}

  private withTimeout<T>(providerId: string, promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${providerId} timed out after ${this.providerTimeoutMs}ms`)), this.providerTimeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async tryProviders<T>(fn: (provider: StockDataProvider) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await this.withTimeout(provider.id, fn(provider));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All providers failed");
  }

  async getQuote(ticker: string): Promise<Quote> {
    return this.tryProviders((provider) => provider.getQuote(ticker));
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    return this.tryProviders((provider) => provider.getOHLCV(ticker, timeframe, from, to));
  }

  async search(query: string): Promise<SearchResult[]> {
    return this.tryProviders((provider) => provider.search(query));
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return this.tryProviders((provider) => provider.getMarketStatus());
  }
}

export const buildProviders = (
  keys: ProviderKeys,
  priority: StockProviderId[] = ["polygon", "finnhub", "alphaVantage", "yahoo", "mock"]
): StockDataProvider[] => {
  const providers: Partial<Record<StockProviderId, StockDataProvider>> = {
    yahoo: new YahooAdapter(),
    mock: new MockAdapter()
  };
  if (keys.polygonApiKey) providers.polygon = new PolygonAdapter(keys.polygonApiKey);
  if (keys.finnhubApiKey) providers.finnhub = new FinnhubAdapter(keys.finnhubApiKey);
  if (keys.alphaVantageApiKey) providers.alphaVantage = new AlphaVantageAdapter(keys.alphaVantageApiKey);
  return priority.map((id) => providers[id]).filter((provider): provider is StockDataProvider => Boolean(provider));
};
