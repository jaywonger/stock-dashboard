import { Router } from "express";
import type {
  BasicScreenerFilters,
  ScreenerConfig,
  ScreenerOperator,
  ScreenerRow,
  StockDataProvider,
  WatchlistMetrics
} from "../../src/types";
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateVWAP
} from "../../src/lib/indicators";

const UNIVERSE_BY_EXCHANGE: Record<BasicScreenerFilters["exchange"], string[]> = {
  NYSE: [
    "JPM",
    "BAC",
    "WFC",
    "GS",
    "MS",
    "XOM",
    "CVX",
    "COP",
    "LLY",
    "JNJ",
    "PFE",
    "ABBV",
    "HD",
    "MCD",
    "DIS",
    "NKE",
    "PGR",
    "TROW",
    "ORI",
    "FBP"
  ],
  NASDAQ: [
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
    "AMZN",
    "GOOGL",
    "META",
    "NFLX",
    "AMD",
    "CRM",
    "AVGO",
    "ADBE",
    "QCOM",
    "INTC",
    "CSCO",
    "COST",
    "PEP",
    "TMUS",
    "BKNG",
    "AMAT"
  ],
  AMEX: ["SPY", "QQQ", "DIA", "IWM", "XLE", "XLF", "XLV", "XLI", "XLB", "GLD", "SLV", "USO", "UNG", "GDX"],
  TSX: [
    "SHOP.TO",
    "RY.TO",
    "TD.TO",
    "BMO.TO",
    "ENB.TO",
    "TRP.TO",
    "CNQ.TO",
    "SU.TO",
    "BNS.TO",
    "CM.TO",
    "CNR.TO",
    "CP.TO",
    "ATD.TO",
    "BCE.TO",
    "MFC.TO"
  ],
  B3: [
    "PETR4.SA",
    "VALE3.SA",
    "ITUB4.SA",
    "BBDC4.SA",
    "ABEV3.SA",
    "BBAS3.SA",
    "WEGE3.SA",
    "PRIO3.SA",
    "SUZB3.SA",
    "LREN3.SA",
    "RENT3.SA",
    "RADL3.SA",
    "CSAN3.SA",
    "GGBR4.SA",
    "JBSS3.SA"
  ],
  LSE: ["SHEL.L", "AZN.L", "RIO.L", "BP.L", "HSBA.L", "BARC.L", "ULVR.L", "LSEG.L", "GSK.L", "NG.L", "RR.L", "LLOY.L"],
  OTC: ["RHHBY", "NTDOY", "TCEHY", "BYDDF", "BASFY", "NSRGY", "VWAGY", "NVO", "XIACY", "DANOY", "SNY", "BAYRY"],
  All: []
};

const DEFAULT_UNIVERSE = Array.from(
  new Set(
    Object.entries(UNIVERSE_BY_EXCHANGE)
      .filter(([exchange]) => exchange !== "All")
      .flatMap(([, symbols]) => symbols)
  )
);

const resolveUniverse = (exchange: BasicScreenerFilters["exchange"]): string[] => {
  if (exchange === "All") return DEFAULT_UNIVERSE;
  return UNIVERSE_BY_EXCHANGE[exchange] ?? DEFAULT_UNIVERSE;
};

const checkOperator = (operator: ScreenerOperator, current: number, compare: number | [number, number], previous: number): boolean => {
  switch (operator) {
    case ">":
      return current > Number(compare);
    case "<":
      return current < Number(compare);
    case "=":
      return current === Number(compare);
    case "between": {
      const [min, max] = Array.isArray(compare) ? compare : [Number(compare), Number(compare)];
      return current >= min && current <= max;
    }
    case "crosses above":
      return previous <= Number(compare) && current > Number(compare);
    case "crosses below":
      return previous >= Number(compare) && current < Number(compare);
    default:
      return false;
  }
};

const applyBasicFilters = (row: ScreenerRow, config: ScreenerConfig): boolean => {
  const { basic } = config;
  if (basic.priceMin !== null && row.price < basic.priceMin) return false;
  if (basic.priceMax !== null && row.price > basic.priceMax) return false;
  if (basic.marketCapRange.min !== null && row.marketCap < basic.marketCapRange.min) return false;
  if (basic.marketCapRange.max !== null && row.marketCap > basic.marketCapRange.max) return false;
  if (basic.minAverageVolume30d !== null && row.volume < basic.minAverageVolume30d) return false;
  if (basic.sectors.length > 0 && !basic.sectors.includes(row.sector)) return false;
  return true;
};

export const createScreenerRouter = (stockService: StockDataProvider) => {
  const router = Router();

  router.post("/run", async (req, res) => {
    try {
      const config = req.body as ScreenerConfig;
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 380);
      const symbols = resolveUniverse(config.basic.exchange);

      const rows = (
        await Promise.all(
          symbols.map(async (symbol) => {
            try {
              const [quote, ohlcv] = await Promise.all([
                stockService.getQuote(symbol),
                stockService.getOHLCV(symbol, "1D", from, to)
              ]);
              if (!ohlcv.length) return null;

              const close = ohlcv.at(-1)?.close ?? quote.price;
              const prevClose = ohlcv.at(-2)?.close ?? close;
              const volume = ohlcv.at(-1)?.volume ?? 0;
              const avgVol30 =
                ohlcv.slice(-30).reduce((sum, row) => sum + row.volume, 0) / Math.max(ohlcv.slice(-30).length, 1);
              const relVol = avgVol30 ? volume / avgVol30 : 0;

              const rsiSeries = calculateRSI(ohlcv, 14);
              const macdSeries = calculateMACD(ohlcv);
              const ema20 = calculateEMA(ohlcv, 20);
              const ema50 = calculateEMA(ohlcv, 50);
              const sma200 = calculateSMA(ohlcv, 200);
              const vwap = calculateVWAP(ohlcv);
              const atr = calculateATR(ohlcv, 14);
              const bb = calculateBollingerBands(ohlcv, 20, 2);

              const latestRsi = rsiSeries.at(-1)?.value ?? null;
              const latestMacd = macdSeries.at(-1)?.macd ?? null;
              const macdSignal = macdSeries.at(-1)?.signal ?? null;
              const prevEma50 = ema50.at(-2)?.value ?? 0;
              const latestEma50 = ema50.at(-1)?.value ?? 0;
              const latestEma20 = ema20.at(-1)?.value ?? 0;
              const latestSma200 = sma200.at(-1)?.value ?? 0;
              const latestVwap = vwap.at(-1)?.value ?? 0;
              const latestAtr = atr.at(-1)?.value ?? 0;
              const latestBb = bb.at(-1)?.percentB ?? 0;
              const high52 = Math.max(...ohlcv.slice(-252).map((item) => item.high));
              const low52 = Math.min(...ohlcv.slice(-252).map((item) => item.low));
              const distance52 = high52 === low52 ? 0 : ((close - low52) / (high52 - low52)) * 100;

              const metrics: Record<string, { current: number; previous: number }> = {
                RSI: { current: latestRsi ?? 0, previous: rsiSeries.at(-2)?.value ?? 0 },
                "MACD Signal": { current: macdSignal ?? 0, previous: macdSeries.at(-2)?.signal ?? 0 },
                "EMA(20)": { current: latestEma20, previous: ema20.at(-2)?.value ?? 0 },
                "EMA(50)": { current: latestEma50, previous: prevEma50 },
                "SMA(200)": { current: latestSma200, previous: sma200.at(-2)?.value ?? 0 },
                "Price vs VWAP": {
                  current: latestVwap ? close / latestVwap : 0,
                  previous: vwap.at(-2)?.value ? prevClose / (vwap.at(-2)?.value ?? 1) : 0
                },
                ATR: { current: latestAtr, previous: atr.at(-2)?.value ?? 0 },
                "Volume vs Avg Volume": { current: relVol, previous: 1 },
                "Bollinger %B": { current: latestBb, previous: bb.at(-2)?.percentB ?? 0 },
                "Distance from 52W High/Low": { current: distance52, previous: distance52 }
              };

              const conditionChecks = config.technicalConditions.map((condition) =>
                checkOperator(
                  condition.operator,
                  metrics[condition.indicator].current,
                  condition.value,
                  metrics[condition.indicator].previous
                )
              );
              const passesTechnical =
                config.technicalConditions.length === 0
                  ? true
                  : config.technicalJoin === "AND"
                    ? conditionChecks.every(Boolean)
                    : conditionChecks.some(Boolean);

              const signals: string[] = [];
              if ((latestRsi ?? 50) < 30) signals.push("Oversold RSI");
              if (relVol > 2) signals.push("High RelVol");
              if (latestEma20 > close) signals.push("Below EMA20");
              if (latestEma20 < close) signals.push("Above EMA20");
              if (latestEma50 > latestSma200) signals.push("Trend Strength");

              const row: ScreenerRow = {
                symbol,
                company: quote.companyName,
                price: quote.price,
                changePercent: quote.changePercent,
                volume,
                relativeVolume: relVol,
                rsi: latestRsi,
                macd: latestMacd,
                activeSignals: signals,
                sector: "Technology",
                marketCap: 40_000_000_000 + Math.floor(Math.random() * 500_000_000_000),
                sparkline: ohlcv.slice(-5).map((item) => item.close)
              };

              if (!applyBasicFilters(row, config)) return null;
              if (!passesTechnical) return null;
              return row;
            } catch {
              return null;
            }
          })
        )
      ).filter((row): row is ScreenerRow => Boolean(row));

      res.json({ rows });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Screener run failed" });
    }
  });

  router.post("/metrics", async (req, res) => {
    try {
      const symbols: string[] = Array.isArray(req.body?.symbols)
        ? req.body.symbols
            .map((value: unknown) => String(value ?? "").toUpperCase().trim())
            .filter((value: string) => Boolean(value))
        : [];
      if (symbols.length === 0) return res.json({ rows: [] as WatchlistMetrics[] });

      const uniqueSymbols: string[] = Array.from(new Set<string>(symbols));
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 380);

      const rows = (
        await Promise.all(
          uniqueSymbols.map(async (symbol) => {
            try {
              const [quote, ohlcv] = await Promise.all([
                stockService.getQuote(symbol),
                stockService.getOHLCV(symbol, "1D", from, to)
              ]);
              if (!ohlcv.length) return null;

              const volume = ohlcv.at(-1)?.volume ?? quote.volume ?? 0;
              const avgVol30 =
                ohlcv.slice(-30).reduce((sum, row) => sum + row.volume, 0) / Math.max(ohlcv.slice(-30).length, 1);
              const relVol = avgVol30 ? volume / avgVol30 : null;

              const rsiSeries = calculateRSI(ohlcv, 14);
              const macdSeries = calculateMACD(ohlcv);

              const row: WatchlistMetrics = {
                symbol,
                relativeVolume: relVol,
                rsi: rsiSeries.at(-1)?.value ?? null,
                macd: macdSeries.at(-1)?.macd ?? null,
                sector: "Technology"
              };
              return row;
            } catch {
              return null;
            }
          })
        )
      ).filter((row): row is WatchlistMetrics => Boolean(row));

      res.json({ rows });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Watchlist metrics failed" });
    }
  });

  return router;
};
