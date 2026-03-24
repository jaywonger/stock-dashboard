import { useEffect, useRef, useState } from "react";
import type { ChartType, SearchResult, Timeframe } from "../../types";

const timeframes: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M"];
const indicatorOptions = [
  "SMA",
  "EMA",
  "VWAP",
  "Bollinger Bands",
  "Ichimoku",
  "RSI",
  "MACD",
  "Stochastic",
  "CCI",
  "Williams %R",
  "OBV",
  "CMF",
  "ATR",
  "Keltner"
];

interface IndicatorControlsProps {
  ticker: string;
  timeframe: Timeframe;
  chartType: ChartType;
  activeIndicators: string[];
  onTickerChange: (ticker: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onChartTypeChange: (chartType: ChartType) => void;
  onIndicatorsChange: (indicators: string[]) => void;
  onCompare: (ticker: string | null) => void;
}

export function IndicatorControls({
  ticker,
  timeframe,
  chartType,
  activeIndicators,
  onTickerChange,
  onTimeframeChange,
  onChartTypeChange,
  onIndicatorsChange,
  onCompare
}: IndicatorControlsProps) {
  const [query, setQuery] = useState(ticker);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [compareInput, setCompareInput] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const suppressNextSearch = useRef(false);

  useEffect(() => {
    setQuery(ticker);
    setSearchResults([]);
  }, [ticker]);

  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false;
      return;
    }
    if (!isSearchFocused) return;
    const id = window.setTimeout(async () => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      const response = await fetch(`/api/quotes/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as SearchResult[];
      setSearchResults(payload.slice(0, 8));
    }, 250);
    return () => window.clearTimeout(id);
  }, [query, isSearchFocused]);

  return (
    <div className="mb-2 rounded border border-border bg-panel p-2">
      <div className="mb-2 grid gap-2 md:grid-cols-[1.6fr,1fr,1fr,1fr,auto]">
        <div className="relative">
          <input
            id="global-search-input"
            className="w-full rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary ticker-font"
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setIsSearchFocused(false), 120);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                suppressNextSearch.current = true;
                setSearchResults([]);
                setIsSearchFocused(false);
                onTickerChange(query.toUpperCase());
              }
            }}
            placeholder="Search symbol or company"
          />
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded border border-border bg-surface">
              {searchResults.map((result) => (
                <button
                  key={result.symbol}
                  className="block w-full border-b border-border px-2 py-1.5 text-left text-xs text-text-muted hover:bg-panel hover:text-text-primary"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    suppressNextSearch.current = true;
                    onTickerChange(result.symbol);
                    setQuery(result.symbol);
                    setSearchResults([]);
                    setIsSearchFocused(false);
                  }}
                >
                  <span className="ticker-font font-semibold text-text-primary">{result.symbol}</span> {result.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary"
          value={chartType}
          onChange={(event) => onChartTypeChange(event.target.value as ChartType)}
        >
          <option value="candlestick">Candlestick</option>
          <option value="line">Line</option>
          <option value="area">Area</option>
          <option value="bar">Bar</option>
        </select>
        <select
          className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary"
          value=""
          onChange={(event) => {
            const selected = event.target.value;
            if (!selected) return;
            onIndicatorsChange(
              activeIndicators.includes(selected)
                ? activeIndicators.filter((item) => item !== selected)
                : [...activeIndicators, selected]
            );
          }}
        >
          <option value="">Indicators</option>
          {indicatorOptions.map((option) => (
            <option key={option} value={option}>
              {activeIndicators.includes(option) ? `✓ ${option}` : option}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary ticker-font"
          placeholder="Compare symbol"
          value={compareInput}
          onChange={(event) => setCompareInput(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCompare(compareInput || null);
          }}
        />
        <button
          className="rounded border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text-primary"
          onClick={() => onCompare(compareInput || null)}
        >
          Compare
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {timeframes.map((item, index) => (
          <button
            key={item}
            className={`rounded border px-2 py-1 text-xs ${
              timeframe === item
                ? "border-neutral bg-neutral/10 text-neutral"
                : "border-border text-text-muted hover:text-text-primary"
            }`}
            onClick={() => onTimeframeChange(item)}
            title={`Shortcut: ${index + 1}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
