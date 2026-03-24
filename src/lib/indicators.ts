import type {
  BollingerPoint,
  IchimokuPoint,
  IndicatorSeriesPoint,
  MACDPoint,
  OHLCV
} from "../types";

export interface StochasticPoint {
  time: string;
  k: number | null;
  d: number | null;
}

export interface KeltnerPoint {
  time: string;
  middle: number | null;
  upper: number | null;
  lower: number | null;
}

export interface VolumeProfileBucket {
  low: number;
  high: number;
  volume: number;
}

const round = (value: number | null): number | null => (value === null ? null : Number(value.toFixed(6)));

/**
 * Computes a simple moving average for close prices.
 */
export function calculateSMA(data: OHLCV[], period: number): IndicatorSeriesPoint[] {
  return data.map((point, index) => {
    if (index < period - 1) return { time: point.time, value: null };
    const slice = data.slice(index - period + 1, index + 1);
    const avg = slice.reduce((sum, item) => sum + item.close, 0) / period;
    return { time: point.time, value: round(avg) };
  });
}

/**
 * Computes an exponential moving average for close prices.
 */
export function calculateEMA(data: OHLCV[], period: number): IndicatorSeriesPoint[] {
  const multiplier = 2 / (period + 1);
  let prevEma: number | null = null;
  return data.map((point, index) => {
    if (index < period - 1) return { time: point.time, value: null };
    if (index === period - 1) {
      const seed = data.slice(0, period).reduce((sum, item) => sum + item.close, 0) / period;
      prevEma = seed;
      return { time: point.time, value: round(seed) };
    }
    prevEma = (point.close - (prevEma ?? point.close)) * multiplier + (prevEma ?? point.close);
    return { time: point.time, value: round(prevEma) };
  });
}

/**
 * Computes VWAP from typical price and cumulative volume.
 */
export function calculateVWAP(data: OHLCV[]): IndicatorSeriesPoint[] {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  return data.map((point) => {
    const typicalPrice = (point.high + point.low + point.close) / 3;
    cumulativePriceVolume += typicalPrice * point.volume;
    cumulativeVolume += point.volume;
    return {
      time: point.time,
      value: cumulativeVolume === 0 ? null : round(cumulativePriceVolume / cumulativeVolume)
    };
  });
}

/**
 * Computes Bollinger bands (upper/middle/lower) and percent B.
 */
export function calculateBollingerBands(
  data: OHLCV[],
  period = 20,
  stdDevMultiplier = 2
): BollingerPoint[] {
  const sma = calculateSMA(data, period);
  return data.map((point, index) => {
    const middle = sma[index]?.value ?? null;
    if (index < period - 1 || middle === null) {
      return {
        time: point.time,
        upper: null,
        middle: null,
        lower: null,
        percentB: null
      };
    }
    const window = data.slice(index - period + 1, index + 1);
    const variance = window.reduce((sum, item) => sum + (item.close - middle) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);
    const upper = middle + stdDevMultiplier * deviation;
    const lower = middle - stdDevMultiplier * deviation;
    const range = upper - lower;
    return {
      time: point.time,
      upper: round(upper),
      middle: round(middle),
      lower: round(lower),
      percentB: range === 0 ? null : round((point.close - lower) / range)
    };
  });
}

const highest = (values: number[]): number => Math.max(...values);
const lowest = (values: number[]): number => Math.min(...values);

/**
 * Computes Ichimoku cloud lines using standard periods.
 */
export function calculateIchimoku(data: OHLCV[]): IchimokuPoint[] {
  return data.map((point, index) => {
    const tenkanWindow = data.slice(Math.max(0, index - 8), index + 1);
    const kijunWindow = data.slice(Math.max(0, index - 25), index + 1);
    const spanBWindow = data.slice(Math.max(0, index - 51), index + 1);

    const tenkanSen =
      tenkanWindow.length < 9
        ? null
        : (highest(tenkanWindow.map((i) => i.high)) + lowest(tenkanWindow.map((i) => i.low))) / 2;
    const kijunSen =
      kijunWindow.length < 26
        ? null
        : (highest(kijunWindow.map((i) => i.high)) + lowest(kijunWindow.map((i) => i.low))) / 2;
    const senkouSpanB =
      spanBWindow.length < 52
        ? null
        : (highest(spanBWindow.map((i) => i.high)) + lowest(spanBWindow.map((i) => i.low))) / 2;
    const senkouSpanA = tenkanSen !== null && kijunSen !== null ? (tenkanSen + kijunSen) / 2 : null;
    const chikouIndex = index - 26;
    const chikouSpan = chikouIndex >= 0 ? data[chikouIndex].close : null;

    return {
      time: point.time,
      tenkanSen: round(tenkanSen),
      kijunSen: round(kijunSen),
      senkouSpanA: round(senkouSpanA),
      senkouSpanB: round(senkouSpanB),
      chikouSpan: round(chikouSpan)
    };
  });
}

/**
 * Computes RSI (Wilder smoothing).
 */
export function calculateRSI(data: OHLCV[], period = 14): IndicatorSeriesPoint[] {
  if (data.length === 0) return [];
  const results: IndicatorSeriesPoint[] = data.map((point) => ({ time: point.time, value: null }));
  if (data.length <= period) return results;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = data[i].close - data[i - 1].close;
    gainSum += Math.max(0, change);
    lossSum += Math.max(0, -change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  results[period] = { time: data[period].time, value: round(100 - 100 / (1 + rs)) };

  for (let i = period + 1; i < data.length; i += 1) {
    const change = data[i].close - data[i - 1].close;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    results[i] = { time: data[i].time, value: round(100 - 100 / (1 + rs)) };
  }
  return results;
}

/**
 * Computes MACD line, signal line, and histogram.
 */
export function calculateMACD(
  data: OHLCV[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDPoint[] {
  const fast = calculateEMA(data, fastPeriod);
  const slow = calculateEMA(data, slowPeriod);
  const macdRaw = data.map((point, index) => {
    const f = fast[index]?.value;
    const s = slow[index]?.value;
    return {
      time: point.time,
      value: f !== null && s !== null && f !== undefined && s !== undefined ? f - s : null
    };
  });

  let signalEma: number | null = null;
  const signal: Array<number | null> = macdRaw.map((point, index) => {
    const value = point.value;
    if (value === null) return null;
    const history = macdRaw.slice(0, index + 1).filter((item) => item.value !== null).map((item) => item.value!);
    if (history.length < signalPeriod) return null;
    if (history.length === signalPeriod) {
      signalEma = history.reduce((sum, item) => sum + item, 0) / signalPeriod;
      return signalEma;
    }
    const multiplier = 2 / (signalPeriod + 1);
    signalEma = (value - (signalEma ?? value)) * multiplier + (signalEma ?? value);
    return signalEma;
  });

  return data.map((point, index) => {
    const macd = macdRaw[index].value;
    const signalValue = signal[index];
    return {
      time: point.time,
      macd: round(macd),
      signal: round(signalValue),
      histogram: macd !== null && signalValue !== null ? round(macd - signalValue) : null
    };
  });
}

/**
 * Computes stochastic oscillator (%K/%D).
 */
export function calculateStochastic(data: OHLCV[], period = 14, signalPeriod = 3): StochasticPoint[] {
  const kValues: Array<number | null> = [];
  const output: StochasticPoint[] = [];

  for (let i = 0; i < data.length; i += 1) {
    if (i < period - 1) {
      kValues.push(null);
      output.push({ time: data[i].time, k: null, d: null });
      continue;
    }
    const window = data.slice(i - period + 1, i + 1);
    const high = highest(window.map((p) => p.high));
    const low = lowest(window.map((p) => p.low));
    const k = high === low ? 0 : ((data[i].close - low) / (high - low)) * 100;
    kValues.push(k);

    const validK = kValues.filter((value) => value !== null).map((value) => value!);
    const d =
      validK.length >= signalPeriod
        ? validK.slice(validK.length - signalPeriod).reduce((sum, value) => sum + value, 0) / signalPeriod
        : null;
    output.push({ time: data[i].time, k: round(k), d: round(d) });
  }
  return output;
}

/**
 * Computes Commodity Channel Index.
 */
export function calculateCCI(data: OHLCV[], period = 20): IndicatorSeriesPoint[] {
  const typicalPrices = data.map((point) => (point.high + point.low + point.close) / 3);
  return data.map((point, index) => {
    if (index < period - 1) return { time: point.time, value: null };
    const window = typicalPrices.slice(index - period + 1, index + 1);
    const sma = window.reduce((sum, value) => sum + value, 0) / period;
    const meanDev = window.reduce((sum, value) => sum + Math.abs(value - sma), 0) / period;
    const cci = meanDev === 0 ? 0 : (typicalPrices[index] - sma) / (0.015 * meanDev);
    return { time: point.time, value: round(cci) };
  });
}

/**
 * Computes Williams %R.
 */
export function calculateWilliamsR(data: OHLCV[], period = 14): IndicatorSeriesPoint[] {
  return data.map((point, index) => {
    if (index < period - 1) return { time: point.time, value: null };
    const window = data.slice(index - period + 1, index + 1);
    const hh = highest(window.map((p) => p.high));
    const ll = lowest(window.map((p) => p.low));
    const value = hh === ll ? 0 : ((hh - point.close) / (hh - ll)) * -100;
    return { time: point.time, value: round(value) };
  });
}

/**
 * Computes On-Balance Volume.
 */
export function calculateOBV(data: OHLCV[]): IndicatorSeriesPoint[] {
  let current = 0;
  return data.map((point, index) => {
    if (index === 0) return { time: point.time, value: 0 };
    const prev = data[index - 1].close;
    if (point.close > prev) current += point.volume;
    else if (point.close < prev) current -= point.volume;
    return { time: point.time, value: current };
  });
}

/**
 * Computes a volume profile histogram for a visible range.
 */
export function calculateVolumeProfile(data: OHLCV[], bucketCount = 12): VolumeProfileBucket[] {
  if (data.length === 0) return [];
  const low = lowest(data.map((p) => p.low));
  const high = highest(data.map((p) => p.high));
  if (low === high) {
    return [{ low, high, volume: data.reduce((sum, p) => sum + p.volume, 0) }];
  }
  const bucketSize = (high - low) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    low: low + bucketSize * index,
    high: low + bucketSize * (index + 1),
    volume: 0
  }));

  for (const candle of data) {
    const typical = (candle.high + candle.low + candle.close) / 3;
    const bucketIndex = Math.min(Math.floor((typical - low) / bucketSize), bucketCount - 1);
    buckets[bucketIndex].volume += candle.volume;
  }
  return buckets;
}

/**
 * Computes Chaikin Money Flow.
 */
export function calculateCMF(data: OHLCV[], period = 20): IndicatorSeriesPoint[] {
  return data.map((point, index) => {
    if (index < period - 1) return { time: point.time, value: null };
    const window = data.slice(index - period + 1, index + 1);
    const mfv = window.map((candle) => {
      const range = candle.high - candle.low;
      const mfm = range === 0 ? 0 : ((candle.close - candle.low) - (candle.high - candle.close)) / range;
      return mfm * candle.volume;
    });
    const mfvSum = mfv.reduce((sum, value) => sum + value, 0);
    const volumeSum = window.reduce((sum, candle) => sum + candle.volume, 0);
    return { time: point.time, value: volumeSum === 0 ? null : round(mfvSum / volumeSum) };
  });
}

/**
 * Computes Average True Range with Wilder smoothing.
 */
export function calculateATR(data: OHLCV[], period = 14): IndicatorSeriesPoint[] {
  if (data.length === 0) return [];
  const trValues = data.map((point, index) => {
    if (index === 0) return point.high - point.low;
    const prevClose = data[index - 1].close;
    return Math.max(point.high - point.low, Math.abs(point.high - prevClose), Math.abs(point.low - prevClose));
  });

  const result: IndicatorSeriesPoint[] = data.map((point) => ({ time: point.time, value: null }));
  if (data.length <= period) return result;

  let atr = trValues.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;
  result[period] = { time: data[period].time, value: round(atr) };
  for (let i = period + 1; i < data.length; i += 1) {
    atr = ((atr * (period - 1)) + trValues[i]) / period;
    result[i] = { time: data[i].time, value: round(atr) };
  }
  return result;
}

/**
 * Computes Keltner channels from EMA and ATR.
 */
export function calculateKeltnerChannels(
  data: OHLCV[],
  period = 20,
  atrPeriod = 10,
  multiplier = 2
): KeltnerPoint[] {
  const ema = calculateEMA(data, period);
  const atr = calculateATR(data, atrPeriod);
  return data.map((point, index) => {
    const middle = ema[index]?.value ?? null;
    const atrValue = atr[index]?.value ?? null;
    if (middle === null || atrValue === null) {
      return { time: point.time, middle: null, upper: null, lower: null };
    }
    return {
      time: point.time,
      middle: round(middle),
      upper: round(middle + multiplier * atrValue),
      lower: round(middle - multiplier * atrValue)
    };
  });
}

/**
 * Returns the latest non-null value in a series.
 */
export function latestSeriesValue(series: IndicatorSeriesPoint[]): number | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].value !== null) return series[i].value;
  }
  return null;
}
