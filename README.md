# Stock Market Intelligence Dashboard

Full-stack stock intelligence dashboard built with React + TypeScript + Express + SQLite.

## Stack

- Frontend: React 18, TypeScript, Tailwind CSS v3, Zustand, TanStack Query v5
- Charts: TradingView Lightweight Charts, Recharts
- Backend: Node.js + Express
- Storage: SQLite (`better-sqlite3`) for watchlists, alerts, screener presets, and caches

## Features Implemented

- Three-panel dark dashboard layout with collapsible left/right panels
- Global market bar with SPY/QQQ/DIA/IWM/VIX and market session indicator
- Watchlist manager with multiple watchlists, CSV import/export, SQLite persistence
- Chart panel with timeframe/chart controls, compare overlay, indicator overlays (SMA/EMA/VWAP)
- Technical indicator library in `src/lib/indicators.ts` with tests
- Screener configuration panel + preset templates + results table
- News aggregation from multiple sources with dedup + sentiment scoring
- Alerts engine with browser notifications + API polling
- Settings modal (API keys, refresh intervals, notifications)
- Zero-config startup mode with mock data fallback

## Project Structure

```text
src/
  components/
  hooks/
  lib/
  services/
  store/
  types/
server/
  db/
  routes/
tests/
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Start app (frontend + backend):

```bash
npm run dev
```

4. Open:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api/health`

## Scripts

- `npm run dev` – start frontend + backend in watch mode
- `npm run typecheck` – run TypeScript type checks
- `npm test` – run Vitest suite
- `npm run build` – production build

## Required API Keys

Optional (dashboard still works with mock fallback):

- `POLYGON_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `FINNHUB_API_KEY`
- `NEWSAPI_KEY`
- `BENZINGA_API_KEY`
- `RSS_FEED_URLS`

## Data Layer Notes

- Unified provider interface is defined in [`src/types/index.ts`](./src/types/index.ts).
- Fallback chain is managed in [`src/services/stockDataService.ts`](./src/services/stockDataService.ts).
- Implemented provider adapters:
  - [`src/services/providers/polygonAdapter.ts`](./src/services/providers/polygonAdapter.ts)
  - [`src/services/providers/alphaVantageAdapter.ts`](./src/services/providers/alphaVantageAdapter.ts)
  - [`src/services/providers/finnhubAdapter.ts`](./src/services/providers/finnhubAdapter.ts)
  - [`src/services/providers/yahooAdapter.ts`](./src/services/providers/yahooAdapter.ts)
  - [`src/services/providers/mockAdapter.ts`](./src/services/providers/mockAdapter.ts)

## Adding a New Data Provider

1. Create a new adapter in `src/services/providers/<provider>Adapter.ts` implementing `StockDataProvider`.
2. Add the provider id to `StockProviderId` in `src/types/index.ts`.
3. Register the adapter in `buildProviders()` inside `src/services/stockDataService.ts`.
4. Add it to settings UI/provider priority if you want user control.

## Adding a New Indicator

1. Implement indicator function in [`src/lib/indicators.ts`](./src/lib/indicators.ts) with JSDoc.
2. Add/extend tests in [`tests/indicators.test.ts`](./tests/indicators.test.ts).
3. Wire indicator usage into:
   - chart overlays in `src/components/chart/MainChart.tsx`
   - screener logic in `server/routes/screener.ts` if needed
   - indicator controls in `src/components/chart/IndicatorControls.tsx`

## Caching and Persistence

- SQLite schema: [`server/db/schema.sql`](./server/db/schema.sql)
- Database helpers: [`server/db/database.ts`](./server/db/database.ts)
- OHLCV cache TTL by timeframe in `server/routes/ohlcv.ts`
- News cache TTL is 5 minutes in `server/routes/news.ts`

## Notes

- API keys in Settings are stored client-side via Zustand persist (`localStorage`).
- Server env keys are used by backend routes for reliable provider access/proxying.
- If all external providers fail, mock data still keeps dashboard interactive.
