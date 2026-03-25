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
- **AI Agents** (NEW):
  - 🤖 **Stock Analysis Agent**: AI-powered stock analysis with entry/stop/target prices, technical analysis, and risk assessment
  - 💬 **Conversational Chat Agent**: Natural language Q&A about stocks, market conditions, and comparisons
  - 🔔 **Autonomous Monitor Agent**: Real-time monitoring for technical patterns (golden/death cross), volume spikes, and sentiment shifts

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

OpenInsider is also used for insider-trading context in analysis routes (no API key required):
- `OPENINSIDER_ENABLED` (default `true`)
- `OPENINSIDER_LOOKBACK_DAYS` (default `30`)
- `OPENINSIDER_TIMEOUT_MS` (default `8000`)
- `OPENINSIDER_SCORE_WEIGHT` (default `1.4`, allowed `0.2` to `3.0`)

### AI Agent API Keys (Optional)

For AI-powered features (stock analysis, chat, monitoring):

- `LITELLM_MODEL` – LiteLLM model name (e.g., `gemini/gemini-2.0-flash`)
- `LITELLM_API_KEY` – LiteLLM API key
- `GEMINI_API_KEY` – Google AI Studio key (alternative)
- `OPENAI_API_KEY` – OpenAI or compatible API key
- `OPENROUTER_API_KEY` – OpenRouter API key
- `CLAUDE_API_KEY` – Anthropic Claude API key
- `LLM_REASONING_EFFORT` – Optional reasoning level (`low`, `medium`, `high`, or `max` aliasing to `high`)

Configure in Settings modal or `.env` file.

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

## AI Agent Features

### Stock Analysis Agent

Click the 🤖 AI button in the header to open the analysis panel for the currently selected stock.

**Features:**
- Investment recommendation (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)
- Confidence score (0-100%)
- Entry price range, target price, stop loss
- Risk/reward ratio
- Technical analysis (trend, momentum, MA alignment, RSI)
- Sentiment analysis from recent news
- Action checklist with status indicators
- Risk factors and catalysts

### Conversational Chat Agent

Click the "AI 问答" tab in the right panel to open the chat interface.

**Example questions:**
- "NVDA 现在值得买入吗？"
- "比较 AAPL 和 MSFT"
- "RSI 指标怎么用？"
- "当前美股市场怎么看？"

### Autonomous Monitor Agent

Click the "监控" tab in the right panel to view real-time alerts.

**Monitors for:**
- Golden Cross / Death Cross
- Breakout / Breakdown patterns
- Volume spikes (>3x average)
- RSI extremes (overbought/oversold)
- Moving average bounces
- Sentiment shifts from news

Alerts are prioritized by severity (LOW/MEDIUM/HIGH/CRITICAL).
