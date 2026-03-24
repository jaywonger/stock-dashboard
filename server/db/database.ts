import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { OHLCV, PriceAlert, ScreenerConfig, Watchlist, WatchlistItem } from "../../src/types";

type DatabaseApi = {
  getWatchlists(): Watchlist[];
  createWatchlist(name: string): number;
  addWatchlistItem(watchlistId: number, symbol: string, companyName: string): void;
  removeWatchlistItem(watchlistId: number, symbol: string): void;
  saveScreenerPreset(name: string, config: ScreenerConfig): void;
  getScreenerPresets(): Array<{ id: number; name: string; config: ScreenerConfig; createdAt: string }>;
  saveOHLCVCache(cacheKey: string, symbol: string, timeframe: string, data: OHLCV[], ttlMs: number): void;
  getOHLCVCache(cacheKey: string): OHLCV[] | null;
  saveNewsCache(cacheKey: string, data: unknown, ttlMs: number): void;
  getNewsCache<T>(cacheKey: string): T | null;
  createAlert(symbol: string, targetPrice: number, direction: "above" | "below"): number;
  dismissAlert(id: number): void;
  setAlertTriggered(id: number): void;
  getAlerts(): PriceAlert[];
  getActiveAlerts(): PriceAlert[];
};

const defaultItems: WatchlistItem[] = [
  { symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", sparkline: [482, 486, 488, 485, 490, 494, 496] },
  { symbol: "AAPL", companyName: "Apple Inc.", sparkline: [185, 186, 184, 187, 189, 190, 192] },
  { symbol: "MSFT", companyName: "Microsoft Corporation", sparkline: [403, 406, 409, 407, 412, 414, 417] },
  { symbol: "TSLA", companyName: "Tesla, Inc.", sparkline: [214, 218, 211, 220, 226, 223, 231] },
  { symbol: "NVDA", companyName: "NVIDIA Corporation", sparkline: [860, 872, 881, 877, 896, 905, 918] }
];

const nowIso = (): string => new Date().toISOString();
const defaultSparklineBySymbol = new Map(defaultItems.map((item) => [item.symbol.toUpperCase(), item.sparkline ?? []]));

const seededSparkline = (symbol: string): number[] => {
  const preset = defaultSparklineBySymbol.get(symbol.toUpperCase());
  if (preset && preset.length > 0) return preset;
  const chars = symbol.toUpperCase().split("");
  const seed = chars.reduce((sum, ch, index) => sum + ch.charCodeAt(0) * (index + 1), 0);
  const length = 24;
  const base = 80 + (seed % 140);
  const values: number[] = [];
  let current = base;
  for (let i = 0; i < length; i += 1) {
    const wave = Math.sin((i + seed % 7) / 2.6) * 1.8;
    const drift = ((seed % 11) - 5) * 0.03;
    const noise = (((seed + i * 17) % 9) - 4) * 0.25;
    current = Math.max(1, current + wave + drift + noise);
    values.push(Number(current.toFixed(2)));
  }
  return values;
};

const createInMemoryDatabase = (): DatabaseApi => {
  let nextWatchlistId = 1;
  let nextPresetId = 1;
  let nextAlertId = 1;

  const watchlists = new Map<number, { id: number; name: string; createdAt: string; updatedAt: string }>();
  const watchlistItems = new Map<number, Map<string, { symbol: string; companyName: string }>>();
  const screenerPresets: Array<{ id: number; name: string; config: ScreenerConfig; createdAt: string }> = [];
  const ohlcvCache = new Map<string, { data: OHLCV[]; expiresAt: number }>();
  const newsCache = new Map<string, { data: unknown; expiresAt: number }>();
  const alerts: Array<{
    id: number;
    symbol: string;
    targetPrice: number;
    direction: "above" | "below";
    status: "active" | "triggered" | "dismissed";
    createdAt: string;
    triggeredAt?: string;
  }> = [];

  const defaultWatchlistId = nextWatchlistId++;
  watchlists.set(defaultWatchlistId, {
    id: defaultWatchlistId,
    name: "Default",
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  watchlistItems.set(defaultWatchlistId, new Map(defaultItems.map((item) => [item.symbol, item])));

  return {
    getWatchlists(): Watchlist[] {
      const rows = Array.from(watchlists.values()).sort((a, b) => a.id - b.id);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        items: Array.from(watchlistItems.get(row.id)?.values() ?? [])
          .sort((a, b) => a.symbol.localeCompare(b.symbol))
          .map((item) => ({
            symbol: item.symbol,
            companyName: item.companyName,
            sparkline: seededSparkline(item.symbol)
          })),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },

    createWatchlist(name: string): number {
      const id = nextWatchlistId++;
      watchlists.set(id, { id, name, createdAt: nowIso(), updatedAt: nowIso() });
      watchlistItems.set(id, new Map());
      return id;
    },

    addWatchlistItem(watchlistId: number, symbol: string, companyName: string): void {
      const watchlist = watchlists.get(watchlistId);
      if (!watchlist) return;
      const normalized = symbol.toUpperCase();
      const items = watchlistItems.get(watchlistId) ?? new Map<string, { symbol: string; companyName: string }>();
      items.set(normalized, { symbol: normalized, companyName });
      watchlistItems.set(watchlistId, items);
      watchlist.updatedAt = nowIso();
    },

    removeWatchlistItem(watchlistId: number, symbol: string): void {
      const watchlist = watchlists.get(watchlistId);
      if (!watchlist) return;
      watchlistItems.get(watchlistId)?.delete(symbol.toUpperCase());
      watchlist.updatedAt = nowIso();
    },

    saveScreenerPreset(name: string, config: ScreenerConfig): void {
      const idx = screenerPresets.findIndex((preset) => preset.name === name);
      const record = {
        id: idx >= 0 ? screenerPresets[idx].id : nextPresetId++,
        name,
        config,
        createdAt: nowIso()
      };
      if (idx >= 0) screenerPresets[idx] = record;
      else screenerPresets.push(record);
    },

    getScreenerPresets(): Array<{ id: number; name: string; config: ScreenerConfig; createdAt: string }> {
      return [...screenerPresets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    saveOHLCVCache(cacheKey: string, _symbol: string, _timeframe: string, data: OHLCV[], ttlMs: number): void {
      ohlcvCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    },

    getOHLCVCache(cacheKey: string): OHLCV[] | null {
      const row = ohlcvCache.get(cacheKey);
      if (!row) return null;
      if (Date.now() > row.expiresAt) {
        ohlcvCache.delete(cacheKey);
        return null;
      }
      return row.data;
    },

    saveNewsCache(cacheKey: string, data: unknown, ttlMs: number): void {
      newsCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    },

    getNewsCache<T>(cacheKey: string): T | null {
      const row = newsCache.get(cacheKey);
      if (!row) return null;
      if (Date.now() > row.expiresAt) {
        newsCache.delete(cacheKey);
        return null;
      }
      return row.data as T;
    },

    createAlert(symbol: string, targetPrice: number, direction: "above" | "below"): number {
      const id = nextAlertId++;
      alerts.push({
        id,
        symbol: symbol.toUpperCase(),
        targetPrice,
        direction,
        status: "active",
        createdAt: nowIso()
      });
      return id;
    },

    dismissAlert(id: number): void {
      const alert = alerts.find((item) => item.id === id);
      if (!alert) return;
      alert.status = "dismissed";
    },

    setAlertTriggered(id: number): void {
      const alert = alerts.find((item) => item.id === id);
      if (!alert) return;
      alert.status = "triggered";
      alert.triggeredAt = nowIso();
    },

    getAlerts(): PriceAlert[] {
      return [...alerts]
        .sort((a, b) => b.id - a.id)
        .map((item) => ({
          id: item.id,
          symbol: item.symbol,
          targetPrice: item.targetPrice,
          direction: item.direction,
          status: item.status,
          createdAt: item.createdAt,
          triggeredAt: item.triggeredAt
        }));
    },

    getActiveAlerts(): PriceAlert[] {
      return alerts
        .filter((item) => item.status === "active")
        .sort((a, b) => b.id - a.id)
        .map((item) => ({
          id: item.id,
          symbol: item.symbol,
          targetPrice: item.targetPrice,
          direction: item.direction,
          status: item.status,
          createdAt: item.createdAt,
          triggeredAt: item.triggeredAt
        }));
    }
  };
};

const createSqliteDatabase = (): DatabaseApi => {
  const require = createRequire(import.meta.url);
  const BetterSqlite3 = require("better-sqlite3") as typeof import("better-sqlite3");
  const dbPath = path.resolve(process.cwd(), "server", "db", "stocks.db");
  const schemaPath = path.resolve(process.cwd(), "server", "db", "schema.sql");

  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM watchlists").get() as { count: number };
  if (countRow.count === 0) {
    const insertWatchlist = db.prepare("INSERT INTO watchlists (name) VALUES (?)");
    const insertItem = db.prepare(
      "INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol, company_name) VALUES (?, ?, ?)"
    );
    const result = insertWatchlist.run("Default");
    for (const item of defaultItems) {
      insertItem.run(result.lastInsertRowid, item.symbol, item.companyName);
    }
  }

  const toWatchlistRows = () => {
    const watchlists = db.prepare("SELECT id, name, created_at, updated_at FROM watchlists ORDER BY id").all() as Array<{
      id: number;
      name: string;
      created_at: string;
      updated_at: string;
    }>;
    const items = db.prepare("SELECT watchlist_id, symbol, company_name FROM watchlist_items ORDER BY symbol").all() as Array<{
      watchlist_id: number;
      symbol: string;
      company_name: string;
    }>;
    return watchlists.map((watchlist) => ({
      id: watchlist.id,
      name: watchlist.name,
      items: items
        .filter((item) => item.watchlist_id === watchlist.id)
        .map((item) => ({
          symbol: item.symbol,
          companyName: item.company_name,
          sparkline: seededSparkline(item.symbol)
        })),
      createdAt: new Date(watchlist.created_at).toISOString(),
      updatedAt: new Date(watchlist.updated_at).toISOString()
    })) as Watchlist[];
  };

  return {
    getWatchlists(): Watchlist[] {
      return toWatchlistRows();
    },

    createWatchlist(name: string): number {
      const result = db.prepare("INSERT INTO watchlists (name, updated_at) VALUES (?, datetime('now'))").run(name);
      return Number(result.lastInsertRowid);
    },

    addWatchlistItem(watchlistId: number, symbol: string, companyName: string): void {
      db.prepare(
        "INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol, company_name) VALUES (?, ?, ?)"
      ).run(watchlistId, symbol.toUpperCase(), companyName);
      db.prepare("UPDATE watchlists SET updated_at = datetime('now') WHERE id = ?").run(watchlistId);
    },

    removeWatchlistItem(watchlistId: number, symbol: string): void {
      db.prepare("DELETE FROM watchlist_items WHERE watchlist_id = ? AND symbol = ?").run(
        watchlistId,
        symbol.toUpperCase()
      );
      db.prepare("UPDATE watchlists SET updated_at = datetime('now') WHERE id = ?").run(watchlistId);
    },

    saveScreenerPreset(name: string, config: ScreenerConfig): void {
      db.prepare(
        "INSERT OR REPLACE INTO screener_presets (name, config_json, created_at) VALUES (?, ?, datetime('now'))"
      ).run(name, JSON.stringify(config));
    },

    getScreenerPresets(): Array<{ id: number; name: string; config: ScreenerConfig; createdAt: string }> {
      const rows = db.prepare("SELECT id, name, config_json, created_at FROM screener_presets ORDER BY created_at DESC").all() as Array<{
        id: number;
        name: string;
        config_json: string;
        created_at: string;
      }>;
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        config: JSON.parse(row.config_json) as ScreenerConfig,
        createdAt: new Date(row.created_at).toISOString()
      }));
    },

    saveOHLCVCache(cacheKey: string, symbol: string, timeframe: string, data: OHLCV[], ttlMs: number): void {
      const now = Date.now();
      db.prepare(
        `INSERT OR REPLACE INTO ohlcv_cache
          (cache_key, symbol, timeframe, data_json, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(cacheKey, symbol, timeframe, JSON.stringify(data), now, now + ttlMs);
    },

    getOHLCVCache(cacheKey: string): OHLCV[] | null {
      const row = db.prepare("SELECT data_json, expires_at FROM ohlcv_cache WHERE cache_key = ?").get(cacheKey) as
        | { data_json: string; expires_at: number }
        | undefined;
      if (!row) return null;
      if (Date.now() > row.expires_at) return null;
      return JSON.parse(row.data_json) as OHLCV[];
    },

    saveNewsCache(cacheKey: string, data: unknown, ttlMs: number): void {
      const now = Date.now();
      db.prepare(
        "INSERT OR REPLACE INTO news_cache (cache_key, data_json, cached_at, expires_at) VALUES (?, ?, ?, ?)"
      ).run(cacheKey, JSON.stringify(data), now, now + ttlMs);
    },

    getNewsCache<T>(cacheKey: string): T | null {
      const row = db.prepare("SELECT data_json, expires_at FROM news_cache WHERE cache_key = ?").get(cacheKey) as
        | { data_json: string; expires_at: number }
        | undefined;
      if (!row) return null;
      if (Date.now() > row.expires_at) return null;
      return JSON.parse(row.data_json) as T;
    },

    createAlert(symbol: string, targetPrice: number, direction: "above" | "below"): number {
      const result = db
        .prepare("INSERT INTO alerts (symbol, target_price, direction, status) VALUES (?, ?, ?, 'active')")
        .run(symbol.toUpperCase(), targetPrice, direction);
      return Number(result.lastInsertRowid);
    },

    dismissAlert(id: number): void {
      db.prepare("UPDATE alerts SET status = 'dismissed' WHERE id = ?").run(id);
    },

    setAlertTriggered(id: number): void {
      db.prepare("UPDATE alerts SET status = 'triggered', triggered_at = datetime('now') WHERE id = ?").run(id);
    },

    getAlerts(): PriceAlert[] {
      const rows = db.prepare("SELECT id, symbol, target_price, direction, status, created_at, triggered_at FROM alerts ORDER BY id DESC").all() as Array<{
        id: number;
        symbol: string;
        target_price: number;
        direction: "above" | "below";
        status: "active" | "triggered" | "dismissed";
        created_at: string;
        triggered_at: string | null;
      }>;
      return rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        targetPrice: row.target_price,
        direction: row.direction,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        triggeredAt: row.triggered_at ? new Date(row.triggered_at).toISOString() : undefined
      }));
    },

    getActiveAlerts(): PriceAlert[] {
      const rows = db
        .prepare("SELECT id, symbol, target_price, direction, status, created_at, triggered_at FROM alerts WHERE status = 'active' ORDER BY id DESC")
        .all() as Array<{
        id: number;
        symbol: string;
        target_price: number;
        direction: "above" | "below";
        status: "active" | "triggered" | "dismissed";
        created_at: string;
        triggered_at: string | null;
      }>;
      return rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        targetPrice: row.target_price,
        direction: row.direction,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        triggeredAt: row.triggered_at ? new Date(row.triggered_at).toISOString() : undefined
      }));
    }
  };
};

const createDatabase = (): DatabaseApi => {
  try {
    return createSqliteDatabase();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const traceEnabled = process.env.DB_SQLITE_FALLBACK_TRACE === "1";
    // eslint-disable-next-line no-console
    if (traceEnabled) {
      console.warn(
        `[database] Falling back to in-memory storage because SQLite native bindings are unavailable. ${reason}`
      );
    } else {
      console.warn(
        "[database] SQLite native bindings unavailable. Using in-memory storage (set DB_SQLITE_FALLBACK_TRACE=1 for details)."
      );
    }
    return createInMemoryDatabase();
  }
};

export const database: DatabaseApi = createDatabase();
