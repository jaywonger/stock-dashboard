import { useMemo } from "react";
import { useScreener } from "../../hooks/useScreener";
import { formatCompactNumber, formatPercent, formatPrice } from "../../lib/formatters";
import { useMarketStore } from "../../store/marketStore";
import { useScreenerStore } from "../../store/screenerStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { ScreenerRow } from "../../types";
import { Skeleton } from "../shared/Skeleton";

const columnLabels: Record<keyof ScreenerRow, string> = {
  symbol: "Ticker",
  company: "Company",
  price: "Price",
  changePercent: "Change%",
  volume: "Volume",
  relativeVolume: "Rel.Vol",
  rsi: "RSI",
  macd: "MACD",
  activeSignals: "Signals",
  sector: "Sector",
  marketCap: "Mkt Cap",
  sparkline: "5D"
};

interface ScreenerResultsProps {
  onSelectTicker?: (ticker: string) => void;
}

export function ScreenerResults({ onSelectTicker }: ScreenerResultsProps = {}) {
  const setTicker = useMarketStore((state) => state.setSelectedTicker);
  const selectTicker = onSelectTicker ?? setTicker;
  const { visibleColumns, sortBy, sortDirection, setSort, results } = useScreenerStore();
  const refreshIntervalMs = useSettingsStore((state) => state.refreshIntervals.screener);
  const query = useScreener();
  const displayColumns = visibleColumns.filter((column) => column !== "sparkline");
  const refreshLabel =
    refreshIntervalMs >= 60_000 && refreshIntervalMs % 60_000 === 0
      ? `${refreshIntervalMs / 60_000}m`
      : `${Math.round(refreshIntervalMs / 1000)}s`;

  const sortedRows = useMemo(() => {
    const rows = [...results];
    rows.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      const sign = sortDirection === "asc" ? 1 : -1;
      if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
      return String(left).localeCompare(String(right)) * sign;
    });
    return rows;
  }, [results, sortBy, sortDirection]);

  const renderCell = (row: ScreenerRow, column: keyof ScreenerRow) => {
    switch (column) {
      case "price":
        return <span className="ticker-font">{formatPrice(row.price)}</span>;
      case "changePercent":
        return (
          <span className={`ticker-font ${row.changePercent >= 0 ? "text-bullish" : "text-bearish"}`}>
            {formatPercent(row.changePercent)}
          </span>
        );
      case "volume":
      case "marketCap":
        return <span className="ticker-font">{formatCompactNumber(row[column] as number)}</span>;
      case "relativeVolume":
      case "rsi":
      case "macd":
        return <span className="ticker-font">{typeof row[column] === "number" ? (row[column] as number).toFixed(2) : "-"}</span>;
      case "activeSignals":
        return <span className="text-xs text-text-muted">{row.activeSignals.join(", ") || "-"}</span>;
      case "sparkline":
        return null;
      default:
        return <span>{String(row[column] ?? "-")}</span>;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm font-semibold text-text-primary">Screener Results</h2>
        <p className="shrink-0 text-xs text-text-muted">Refresh {refreshLabel}</p>
      </div>

      {query.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {query.isError && (
        <div className="rounded border border-bearish/30 bg-bearish/10 p-2 text-xs text-bearish">
          Screener request failed. Try again from a less restrictive filter set.
        </div>
      )}
      {!query.isLoading && !query.isError && sortedRows.length === 0 && (
        <div className="rounded border border-border bg-panel p-3 text-xs text-text-muted">
          No screener results. Try relaxing RSI/volume filters or switching to a broader exchange.
        </div>
      )}

      {sortedRows.length > 0 && (
        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-xs">
            <thead className="sticky top-0 bg-panel">
              <tr>
                {displayColumns.map((column) => (
                  <th key={column} className="cursor-pointer border-b border-border px-2 py-2 text-left text-text-muted" onClick={() => setSort(column)}>
                    {columnLabels[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.symbol}
                  className="cursor-pointer border-b border-border/70 transition hover:bg-panel"
                  onClick={() => selectTicker(row.symbol)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    alert(`Actions: Add ${row.symbol} to watchlist, set alert, or view news.`);
                  }}
                >
                  {displayColumns.map((column) => (
                    <td key={`${row.symbol}-${column}`} className="px-2 py-2 align-middle text-text-primary">
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
