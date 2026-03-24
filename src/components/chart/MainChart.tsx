import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart
} from "lightweight-charts";
import type { Time } from "lightweight-charts";
import type { ChartType, Timeframe } from "../../types";
import { useOHLCV } from "../../hooks/useOHLCV";
import {
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateVWAP,
  latestSeriesValue
} from "../../lib/indicators";
import { Skeleton } from "../shared/Skeleton";
import { ChartTooltip } from "./ChartTooltip";

interface MainChartProps {
  ticker: string;
  timeframe: Timeframe;
  chartType: ChartType;
  compareTicker: string | null;
  activeIndicators: string[];
}

interface HoverState {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

const toChartTime = (value: string): Time => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dateTimeNoTz = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

  if (dateOnly.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 1000) as Time;
  }

  if (dateTimeNoTz.test(value)) {
    const normalized = value.replace(" ", "T");
    return Math.floor(Date.parse(`${normalized}Z`) / 1000) as Time;
  }

  return Math.floor(Date.parse(value) / 1000) as Time;
};

export function MainChart({ ticker, timeframe, chartType, compareTicker, activeIndicators }: MainChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverState, setHoverState] = useState<HoverState>({});
  const query = useOHLCV(ticker, timeframe);
  const compareQuery = useOHLCV(compareTicker ?? "", timeframe);

  const indicatorSummary = useMemo(() => {
    if (!query.data || query.data.length === 0) return [];
    return [
      { label: "RSI", value: latestSeriesValue(calculateRSI(query.data)) },
      { label: "MACD", value: calculateMACD(query.data).slice(-1)[0]?.macd ?? null },
      { label: "SMA20", value: latestSeriesValue(calculateSMA(query.data, 20)) },
      { label: "EMA20", value: latestSeriesValue(calculateEMA(query.data, 20)) }
    ];
  }, [query.data]);

  useEffect(() => {
    if (!chartRef.current || !query.data || query.data.length === 0) return;
    const chart = createChart(chartRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#111318" },
        textColor: "#98a2b3"
      },
      grid: {
        vertLines: { color: "#1a2230" },
        horzLines: { color: "#1a2230" }
      },
      rightPriceScale: { borderColor: "#1e2330" },
      timeScale: { borderColor: "#1e2330", timeVisible: true },
      crosshair: { mode: 1 }
    });

    const candleData = query.data.map((row) => ({
      time: toChartTime(row.time),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close
    }));
    const volumeData = query.data.map((row) => ({
      time: toChartTime(row.time),
      value: row.volume,
      color: row.close >= row.open ? "rgba(0, 212, 170, 0.4)" : "rgba(255, 77, 106, 0.4)"
    }));

    let primarySeries: any;

    if (chartType === "candlestick") {
      primarySeries = chart.addSeries(CandlestickSeries, {
        upColor: "#00d4aa",
        downColor: "#ff4d6a",
        borderDownColor: "#ff4d6a",
        borderUpColor: "#00d4aa",
        wickDownColor: "#ff4d6a",
        wickUpColor: "#00d4aa"
      });
      primarySeries.setData(candleData as any);
    } else if (chartType === "area") {
      primarySeries = chart.addSeries(AreaSeries, {
        lineColor: "#4d9fff",
        topColor: "rgba(77, 159, 255, 0.34)",
        bottomColor: "rgba(77, 159, 255, 0.03)"
      });
      primarySeries.setData(query.data.map((row) => ({ time: toChartTime(row.time), value: row.close })) as any);
    } else if (chartType === "bar") {
      primarySeries = chart.addSeries(BarSeries, {
        upColor: "#00d4aa",
        downColor: "#ff4d6a"
      });
      primarySeries.setData(candleData as any);
    } else {
      primarySeries = chart.addSeries(LineSeries, {
        color: "#4d9fff",
        lineWidth: 2
      });
      primarySeries.setData(query.data.map((row) => ({ time: toChartTime(row.time), value: row.close })) as any);
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceFormat: { type: "volume" },
      color: "rgba(77,159,255,0.3)"
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0
      }
    });
    volumeSeries.setData(volumeData as any);

    const sma20 = calculateSMA(query.data, 20);
    const ema20 = calculateEMA(query.data, 20);
    const vwap = calculateVWAP(query.data);

    if (activeIndicators.includes("SMA")) {
      const series = chart.addSeries(LineSeries, { color: "#f5a623", lineWidth: 2 });
      series.setData(
        (sma20
          .filter((item) => item.value !== null)
          .map((item) => ({ time: toChartTime(item.time), value: Number(item.value) })) as any)
      );
    }
    if (activeIndicators.includes("EMA")) {
      const series = chart.addSeries(LineSeries, { color: "#5bd0ff", lineWidth: 2 });
      series.setData(
        (ema20
          .filter((item) => item.value !== null)
          .map((item) => ({ time: toChartTime(item.time), value: Number(item.value) })) as any)
      );
    }
    if (activeIndicators.includes("VWAP")) {
      const series = chart.addSeries(LineSeries, { color: "#9f7aea", lineWidth: 1 });
      series.setData(
        (vwap
          .filter((item) => item.value !== null)
          .map((item) => ({ time: toChartTime(item.time), value: Number(item.value) })) as any)
      );
    }

    if (compareTicker && compareQuery.data && compareQuery.data.length > 0) {
      const compareSeries = chart.addSeries(LineSeries, {
        color: "#7fdb91",
        lineWidth: 1,
        lineStyle: 2
      });
      compareSeries.setData(compareQuery.data.map((row) => ({ time: toChartTime(row.time), value: row.close })) as any);
    }

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      const time = param.time;
      if (!time) return;
      const timeKey = typeof time === "number" ? time : Number.NaN;
      if (!Number.isFinite(timeKey)) return;
      const candle = query.data.find((item) => Number(toChartTime(item.time)) === timeKey);
      if (!candle) return;
      setHoverState({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      });
    });

    return () => chart.remove();
  }, [activeIndicators, chartType, compareQuery.data, compareTicker, query.data]);

  if (query.isLoading) {
    return (
      <div className="card relative h-full p-3">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="card flex h-full items-center justify-center p-3 text-sm text-bearish">
        Failed to load chart data for {ticker}.
      </div>
    );
  }
  if (!query.data || query.data.length === 0) {
    return (
      <div className="card flex h-full items-center justify-center p-3 text-sm text-text-muted">
        No chart data. Try a different timeframe or ticker.
      </div>
    );
  }

  return (
    <div className="card relative h-full p-2">
      <ChartTooltip o={hoverState.open} h={hoverState.high} l={hoverState.low} c={hoverState.close} v={hoverState.volume} indicators={indicatorSummary} />
      <div ref={chartRef} className="h-[calc(100%-34px)] w-full rounded" />
      <div className="mt-1 flex flex-wrap gap-2 px-1">
        {activeIndicators.map((indicator) => (
          <span key={indicator} className="rounded border border-border bg-panel px-2 py-0.5 text-[11px] text-text-muted">
            {indicator}
          </span>
        ))}
      </div>
    </div>
  );
}
