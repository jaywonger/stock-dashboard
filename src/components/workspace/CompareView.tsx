import { useMemo, useState } from "react";
import type { Timeframe } from "../../types";
import { useOHLCV } from "../../hooks/useOHLCV";
import { useQuote } from "../../hooks/useQuote";
import { formatPercent, formatPrice } from "../../lib/formatters";

interface CompareViewProps {
  primaryTicker: string;
  compareTicker: string | null;
  timeframe: Timeframe;
  onCompareChange: (ticker: string | null) => void;
}

const changeFromSeries = (
  rows: Array<{ close: number }> | undefined
): { abs: number; pct: number } | null => {
  if (!rows || rows.length < 2) return null;
  const first = rows[0].close;
  const last = rows[rows.length - 1].close;
  const abs = last - first;
  const pct = first === 0 ? 0 : (abs / first) * 100;
  return { abs, pct };
};

export function CompareView({ primaryTicker, compareTicker, timeframe, onCompareChange }: CompareViewProps) {
  const [input, setInput] = useState(compareTicker ?? "QQQ");
  const leftQuote = useQuote(primaryTicker);
  const rightQuote = useQuote(compareTicker ?? "");
  const leftSeries = useOHLCV(primaryTicker, timeframe);
  const rightSeries = useOHLCV(compareTicker ?? "", timeframe);

  const leftPerf = changeFromSeries(leftSeries.data ?? undefined);
  const rightPerf = changeFromSeries(rightSeries.data ?? undefined);

  const spread = useMemo(() => {
    if (!leftPerf || !rightPerf) return null;
    return leftPerf.pct - rightPerf.pct;
  }, [leftPerf, rightPerf]);

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <h3 className="intel-title">Compare</h3>
        <p className="mt-1 text-xs text-text-muted">
          Compare relative performance and live pricing for two symbols.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Against:</span>
          <input
            className="w-40 rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary ticker-font"
            value={input}
            onChange={(event) => setInput(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCompareChange(input.trim() || null);
            }}
          />
          <button
            className="rounded border border-border px-2 py-1.5 text-xs text-text-muted hover:text-text-primary"
            onClick={() => onCompareChange(input.trim() || null)}
          >
            Apply
          </button>
          {compareTicker && (
            <button
              className="rounded border border-border px-2 py-1.5 text-xs text-text-muted hover:text-text-primary"
              onClick={() => onCompareChange(null)}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="card p-3">
          <div className="mb-2 ticker-font text-sm font-semibold text-text-primary">{primaryTicker}</div>
          <div className="ticker-font text-lg text-text-primary">
            {leftQuote.data ? formatPrice(leftQuote.data.price) : "Loading..."}
          </div>
          <div className={`ticker-font text-sm ${leftPerf && leftPerf.pct >= 0 ? "text-bullish" : "text-bearish"}`}>
            {leftPerf ? formatPercent(leftPerf.pct) : "--"}
          </div>
        </div>

        <div className="card p-3">
          <div className="mb-2 ticker-font text-sm font-semibold text-text-primary">{compareTicker ?? "Not selected"}</div>
          <div className="ticker-font text-lg text-text-primary">
            {compareTicker ? (rightQuote.data ? formatPrice(rightQuote.data.price) : "Loading...") : "--"}
          </div>
          <div className={`ticker-font text-sm ${rightPerf && rightPerf.pct >= 0 ? "text-bullish" : "text-bearish"}`}>
            {compareTicker ? (rightPerf ? formatPercent(rightPerf.pct) : "--") : "--"}
          </div>
        </div>
      </div>

      <div className="card mt-3 p-3">
        <h4 className="mb-2 text-xs uppercase tracking-wide text-text-muted">Relative Strength ({timeframe})</h4>
        <div className="ticker-font text-xl font-semibold text-text-primary">
          {spread === null ? "--" : `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}%`}
        </div>
        {spread !== null && (
          <div className="mt-2">
            <span className={`intel-chip ${spread >= 0 ? "text-bullish" : "text-bearish"}`}>
              {spread >= 0 ? "Leader" : "Lagging"}: {primaryTicker}
            </span>
          </div>
        )}
        <p className="mt-1 text-xs text-text-muted">
          Positive means {primaryTicker} outperformed {compareTicker ?? "comparison ticker"} over the selected range.
        </p>
      </div>
    </section>
  );
}
