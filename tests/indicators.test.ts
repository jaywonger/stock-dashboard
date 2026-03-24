import { describe, expect, it } from "vitest";
import {
  calculateATR,
  calculateBollingerBands,
  calculateCCI,
  calculateCMF,
  calculateEMA,
  calculateIchimoku,
  calculateKeltnerChannels,
  calculateMACD,
  calculateOBV,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateVWAP,
  calculateVolumeProfile,
  calculateWilliamsR,
  latestSeriesValue
} from "../src/lib/indicators";
import type { OHLCV } from "../src/types";

const buildData = (length = 120): OHLCV[] => {
  let last = 100;
  return Array.from({ length }, (_, idx) => {
    const drift = Math.sin(idx / 6) * 1.8 + Math.cos(idx / 9) * 0.9 + 0.4;
    const open = last;
    const close = Math.max(10, open + drift);
    const high = Math.max(open, close) + 0.8 + (idx % 3) * 0.2;
    const low = Math.min(open, close) - 0.7 - (idx % 2) * 0.15;
    const volume = 1_000_000 + idx * 8_000 + (idx % 5) * 60_000;
    last = close;
    return {
      time: new Date(2024, 0, 1 + idx).toISOString(),
      open,
      high,
      low,
      close,
      volume
    };
  });
};

describe("indicators", () => {
  const data = buildData();

  it("computes SMA and EMA", () => {
    const sma = calculateSMA(data, 20);
    const ema = calculateEMA(data, 20);
    expect(sma).toHaveLength(data.length);
    expect(ema).toHaveLength(data.length);
    expect(sma[18].value).toBeNull();
    expect(sma[19].value).not.toBeNull();
    expect(ema[19].value).not.toBeNull();
  });

  it("computes VWAP and OBV", () => {
    const vwap = calculateVWAP(data);
    const obv = calculateOBV(data);
    expect(vwap[10].value).not.toBeNull();
    expect(obv[0].value).toBe(0);
    expect(typeof obv[data.length - 1].value).toBe("number");
  });

  it("computes Bollinger and Keltner channels", () => {
    const bb = calculateBollingerBands(data, 20, 2);
    const kc = calculateKeltnerChannels(data);
    expect(bb[19].upper).not.toBeNull();
    expect(bb[19].lower).not.toBeNull();
    expect(kc[data.length - 1].middle).not.toBeNull();
  });

  it("computes RSI, MACD, and stochastic", () => {
    const rsi = calculateRSI(data, 14);
    const macd = calculateMACD(data);
    const stochastic = calculateStochastic(data);
    expect(rsi[14].value).not.toBeNull();
    expect(macd[data.length - 1].macd).not.toBeNull();
    expect(stochastic[data.length - 1].k).not.toBeNull();
  });

  it("computes CCI, Williams %R, CMF, ATR", () => {
    const cci = calculateCCI(data);
    const wr = calculateWilliamsR(data);
    const cmf = calculateCMF(data);
    const atr = calculateATR(data);
    expect(cci[data.length - 1].value).not.toBeNull();
    expect(wr[data.length - 1].value).not.toBeNull();
    expect(cmf[data.length - 1].value).not.toBeNull();
    expect(atr[data.length - 1].value).not.toBeNull();
  });

  it("computes Ichimoku and volume profile", () => {
    const ichimoku = calculateIchimoku(data);
    const profile = calculateVolumeProfile(data.slice(-60), 10);
    expect(ichimoku[data.length - 1].kijunSen).not.toBeNull();
    expect(profile).toHaveLength(10);
    expect(profile.reduce((sum, bucket) => sum + bucket.volume, 0)).toBeGreaterThan(0);
  });

  it("returns the latest non-null value", () => {
    const sma = calculateSMA(data, 50);
    const latest = latestSeriesValue(sma);
    expect(latest).not.toBeNull();
  });
});
