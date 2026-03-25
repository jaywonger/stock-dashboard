import { AlphaVantageAdapter } from "../../src/services/providers/alphaVantageAdapter";
import { FinnhubAdapter } from "../../src/services/providers/finnhubAdapter";
import { MockAdapter } from "../../src/services/providers/mockAdapter";
import { PolygonAdapter } from "../../src/services/providers/polygonAdapter";
import { YahooAdapter } from "../../src/services/providers/yahooAdapter";
import type { StockDataProvider, StockProviderId } from "../../src/types";
import { YFinanceAdapter } from "./yfinanceAdapter";

interface ProviderFactoryKeys {
  yfinanceEnabled?: boolean;
  yfinancePython?: string;
  polygonApiKey?: string;
  alphaVantageApiKey?: string;
  finnhubApiKey?: string;
}

export const buildProviders = (
  keys: ProviderFactoryKeys,
  priority: StockProviderId[] = ["yfinance", "polygon", "finnhub", "alphaVantage", "yahoo", "mock"]
): StockDataProvider[] => {
  const providers: Partial<Record<StockProviderId, StockDataProvider>> = {
    yahoo: new YahooAdapter(),
    mock: new MockAdapter()
  };
  if (keys.yfinanceEnabled !== false) {
    providers.yfinance = new YFinanceAdapter({ pythonExecutable: keys.yfinancePython });
  }
  if (keys.polygonApiKey) providers.polygon = new PolygonAdapter(keys.polygonApiKey);
  if (keys.finnhubApiKey) providers.finnhub = new FinnhubAdapter(keys.finnhubApiKey);
  if (keys.alphaVantageApiKey) providers.alphaVantage = new AlphaVantageAdapter(keys.alphaVantageApiKey);
  return priority.map((id) => providers[id]).filter((provider): provider is StockDataProvider => Boolean(provider));
};
