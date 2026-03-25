import type { Quote, WatchlistItem, WatchlistMetrics } from "../../types";
import { formatCompactNumber, formatPercent, formatPrice } from "../../lib/formatters";

interface WatchlistRowProps {
  item: WatchlistItem;
  quote?: Quote;
  quoteLoading?: boolean;
  metrics?: WatchlistMetrics;
  metricsLoading?: boolean;
  onClick: () => void;
  onRemove: () => void;
}

export function WatchlistRow({
  item,
  quote,
  quoteLoading = false,
  metrics,
  metricsLoading = false,
  onClick,
  onRemove
}: WatchlistRowProps) {
  const hasPrice = typeof quote?.price === "number" || typeof item.price === "number";
  const hasChange = typeof quote?.changePercent === "number" || typeof item.changePercent === "number";
  const hasVolume = typeof quote?.volume === "number";
  const price = quote?.price ?? item.price ?? 0;
  const change = quote?.changePercent ?? item.changePercent ?? 0;
  const volume = quote?.volume ?? null;
  const companyName = quote?.companyName || item.companyName || item.symbol;
  const color = change >= 0 ? "text-bullish" : "text-bearish";
  return (
    <tr
      className="cursor-pointer border-b border-border/70 text-xs transition hover:bg-panel"
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onRemove();
      }}
      title="Right click to remove"
    >
      <td className="px-2 py-2 align-middle ticker-font font-semibold text-text-primary">{item.symbol}</td>
      <td className="max-w-[220px] px-2 py-2 align-middle text-text-muted">
        <div className="line-clamp-1">{companyName}</div>
      </td>
      <td className="px-2 py-2 align-middle text-right ticker-font text-text-primary">
        {quoteLoading && !hasPrice ? "..." : hasPrice ? formatPrice(price) : "--"}
      </td>
      <td className={`px-2 py-2 align-middle text-right ticker-font ${color}`}>
        {quoteLoading && !hasChange ? "..." : hasChange ? formatPercent(change) : "--"}
      </td>
      <td className="px-2 py-2 align-middle text-right ticker-font text-text-primary">
        {quoteLoading && !hasVolume ? "..." : hasVolume && volume !== null ? formatCompactNumber(volume) : "--"}
      </td>
      <td className="px-2 py-2 align-middle text-right ticker-font text-text-primary">
        {metricsLoading && metrics?.relativeVolume === undefined
          ? "..."
          : typeof metrics?.relativeVolume === "number"
            ? metrics.relativeVolume.toFixed(2)
            : "--"}
      </td>
      <td className="px-2 py-2 align-middle text-right ticker-font text-text-primary">
        {metricsLoading && metrics?.rsi === undefined ? "..." : typeof metrics?.rsi === "number" ? metrics.rsi.toFixed(2) : "--"}
      </td>
      <td className="px-2 py-2 align-middle text-right ticker-font text-text-primary">
        {metricsLoading && metrics?.macd === undefined
          ? "..."
          : typeof metrics?.macd === "number"
            ? metrics.macd.toFixed(2)
            : "--"}
      </td>
      <td className="px-2 py-2 align-middle text-text-muted">
        {metricsLoading && !metrics?.sector ? "..." : metrics?.sector || "--"}
      </td>
    </tr>
  );
}
