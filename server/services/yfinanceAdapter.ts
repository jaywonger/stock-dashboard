import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { MarketStatus, OHLCV, Quote, SearchResult, StockDataProvider, Timeframe } from "../../src/types";

const execFileAsync = promisify(execFile);

interface BridgeResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface YFinanceAdapterOptions {
  pythonExecutable?: string;
  scriptPath?: string;
}

export class YFinanceAdapter implements StockDataProvider {
  id = "yfinance" as const;
  private pythonExecutable: string;
  private scriptPath: string;
  private requestTimeoutMs = Number(process.env.PROVIDER_HTTP_TIMEOUT_MS ?? 12_000);
  private symbolResolutionCacheTtlMs = Number(process.env.YFINANCE_SYMBOL_CACHE_TTL_MS ?? 60 * 60_000);
  private symbolResolutionCache = new Map<string, { resolved: string; expiresAt: number }>();
  private symbolSuffixHints = (process.env.YFINANCE_SYMBOL_SUFFIX_HINTS ?? "SA,T,HK,L,TO,NS,AX")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  private indexAliases: Record<string, string> = {
    VIX: "^VIX",
    SPX: "^GSPC",
    GSPC: "^GSPC",
    NDX: "^NDX",
    DJI: "^DJI",
    RUT: "^RUT"
  };

  constructor(options: YFinanceAdapterOptions = {}) {
    this.pythonExecutable = options.pythonExecutable ?? process.env.YFINANCE_PYTHON ?? "python";
    this.scriptPath =
      options.scriptPath ??
      process.env.YFINANCE_SCRIPT_PATH ??
      path.resolve(process.cwd(), "server", "python", "yfinance_bridge.py");
  }

  private normalizeSymbol(ticker: string): string {
    const upper = ticker.toUpperCase();
    return this.indexAliases[upper] ?? upper;
  }

  private dedupeSymbols(symbols: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of symbols) {
      const symbol = item.toUpperCase();
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      out.push(symbol);
    }
    return out;
  }

  private buildHeuristicCandidates(symbol: string): string[] {
    if (!symbol || symbol.startsWith("^") || symbol.includes(".")) return [symbol];

    const candidates: string[] = [symbol];

    // Common Brazil class-share format without suffix (VALE3, PETR4 -> .SA)
    if (/^[A-Z]{4}\d{1,2}$/.test(symbol)) {
      candidates.push(`${symbol}.SA`);
      return this.dedupeSymbols(candidates);
    }

    // Common Japan and Hong Kong numeric symbols.
    if (/^\d{4}$/.test(symbol)) {
      candidates.push(`${symbol}.T`, `${symbol}.HK`);
      return this.dedupeSymbols(candidates);
    }
    if (/^\d{5}$/.test(symbol)) {
      candidates.push(`${symbol}.HK`);
      return this.dedupeSymbols(candidates);
    }

    // Generic fallback for symbols containing digits.
    if (/\d/.test(symbol)) {
      for (const suffix of this.symbolSuffixHints.slice(0, 3)) {
        candidates.push(`${symbol}.${suffix}`);
      }
    }

    return this.dedupeSymbols(candidates);
  }

  private async tryQuoteCandidates(baseSymbol: string): Promise<Quote> {
    const candidates = this.buildHeuristicCandidates(baseSymbol);
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const quote = await this.callBridge<Quote>("quote", { symbol: candidate });
        if (candidate !== baseSymbol) {
          this.symbolResolutionCache.set(baseSymbol, {
            resolved: quote.symbol?.toUpperCase?.() ?? candidate,
            expiresAt: Date.now() + this.symbolResolutionCacheTtlMs
          });
        }
        return quote;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`No quote data for ${baseSymbol}`);
  }

  private async tryOhlcvCandidates(
    baseSymbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date
  ): Promise<OHLCV[]> {
    const candidates = this.buildHeuristicCandidates(baseSymbol);
    let lastError: unknown;
    const payload = {
      timeframe,
      from: from.toISOString(),
      to: to.toISOString()
    };
    for (const candidate of candidates) {
      try {
        const rows = await this.callBridge<OHLCV[]>("ohlcv", { symbol: candidate, ...payload });
        if (candidate !== baseSymbol && rows.length > 0) {
          this.symbolResolutionCache.set(baseSymbol, {
            resolved: candidate,
            expiresAt: Date.now() + this.symbolResolutionCacheTtlMs
          });
        }
        if (rows.length > 0) return rows;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  }

  private async resolveSymbol(symbol: string): Promise<string> {
    if (!symbol || symbol.startsWith("^") || symbol.includes(".")) return symbol;
    const cached = this.symbolResolutionCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.resolved;

    try {
      const matches = await this.callBridge<SearchResult[]>("search", { query: symbol });
      const upper = symbol.toUpperCase();
      const exact = matches.find((item) => item.symbol.toUpperCase() === upper);
      const exchangeVariant = matches.find((item) => item.symbol.toUpperCase().startsWith(`${upper}.`));
      const prefixed = matches.find((item) => item.symbol.toUpperCase().startsWith(upper));
      const resolved = (exact ?? exchangeVariant ?? prefixed)?.symbol?.toUpperCase() ?? symbol;
      this.symbolResolutionCache.set(symbol, { resolved, expiresAt: Date.now() + this.symbolResolutionCacheTtlMs });
      return resolved;
    } catch {
      return symbol;
    }
  }

  private async callBridge<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const { stdout } = await execFileAsync(this.pythonExecutable, [this.scriptPath, action, JSON.stringify(payload)], {
      timeout: this.requestTimeoutMs,
      maxBuffer: 1_024 * 1_024
    });
    const parsed = JSON.parse(stdout.trim()) as BridgeResponse<T>;
    if (!parsed.ok || parsed.data === undefined) {
      throw new Error(parsed.error ?? `yfinance bridge failed for ${action}`);
    }
    return parsed.data;
  }

  async getQuote(ticker: string): Promise<Quote> {
    const symbol = this.normalizeSymbol(ticker);
    try {
      return await this.tryQuoteCandidates(symbol);
    } catch (error) {
      const resolved = await this.resolveSymbol(symbol);
      if (resolved === symbol) throw error;
      return this.tryQuoteCandidates(resolved);
    }
  }

  async getOHLCV(ticker: string, timeframe: Timeframe, from: Date, to: Date): Promise<OHLCV[]> {
    const symbol = this.normalizeSymbol(ticker);
    try {
      const rows = await this.tryOhlcvCandidates(symbol, timeframe, from, to);
      if (rows.length > 0) return rows;
    } catch (error) {
      const resolved = await this.resolveSymbol(symbol);
      if (resolved === symbol) throw error;
      return this.tryOhlcvCandidates(resolved, timeframe, from, to);
    }
    return [];
  }

  async search(query: string): Promise<SearchResult[]> {
    return this.callBridge<SearchResult[]>("search", { query: query.trim() });
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return this.callBridge<MarketStatus>("market_status", {});
  }
}
