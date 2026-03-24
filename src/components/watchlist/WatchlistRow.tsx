import type { Quote, WatchlistItem } from "../../types";
import { formatPrice, formatPercent } from "../../lib/formatters";
import { Sparkline } from "./Sparkline";

interface WatchlistRowProps {
  item: WatchlistItem;
  quote?: Quote;
  onClick: () => void;
  onRemove: () => void;
}

export function WatchlistRow({ item, quote, onClick, onRemove }: WatchlistRowProps) {
  const price = quote?.price ?? item.price ?? 0;
  const change = quote?.changePercent ?? item.changePercent ?? 0;
  const color = change >= 0 ? "text-bullish" : "text-bearish";
  return (
    <button
      className="w-full rounded border border-transparent px-2 py-2 text-left transition hover:border-border hover:bg-panel"
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onRemove();
      }}
      title="Right click to remove"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="ticker-font text-xs font-semibold text-text-primary">{item.symbol}</div>
          <div className="line-clamp-1 text-[11px] text-text-muted">{item.companyName}</div>
        </div>
        <div className="text-right">
          <div className="ticker-font text-xs text-text-primary">{formatPrice(price)}</div>
          <div className={`ticker-font text-[11px] ${color}`}>{formatPercent(change)}</div>
        </div>
      </div>
      <div className="mt-1">
        <Sparkline values={item.sparkline ?? []} />
      </div>
    </button>
  );
}
