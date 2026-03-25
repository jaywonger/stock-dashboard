import { useMemo } from "react";
import { Activity } from "lucide-react";
import { formatDateTime, formatPrice } from "../../lib/formatters";
import { DEFAULT_TICKERS } from "../../store/marketStore";
import type { Quote } from "../../types";
import { useQuotesBatch } from "../../hooks/useQuotesBatch";
import { PriceChange } from "../shared/PriceChange";

interface LiveMonitorViewProps {
  ticker: string;
  compareTicker: string | null;
}

function LiveTickerCard({ symbol, quote, loading }: { symbol: string; quote?: Quote; loading?: boolean }) {
  return (
    <div className="rounded border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="ticker-font text-sm font-semibold text-text-primary">{symbol}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-bullish">
          <span className="inline-block h-2 w-2 rounded-full bg-bullish" />
          Live
        </span>
      </div>
      {loading || !quote ? (
        <div className="text-xs text-text-muted">Loading quote...</div>
      ) : (
        <>
          <div className="ticker-font text-lg text-text-primary">{formatPrice(quote.price)}</div>
          <PriceChange change={quote.change} changePercent={quote.changePercent} compact />
          <div className="mt-1 text-[11px] text-text-subtle">Updated {formatDateTime(quote.timestamp)}</div>
        </>
      )}
    </div>
  );
}

export function LiveMonitorView({ ticker, compareTicker }: LiveMonitorViewProps) {
  const symbols = useMemo(
    () =>
      Array.from(new Set([ticker, compareTicker ?? "", ...DEFAULT_TICKERS]))
        .filter(Boolean)
        .slice(0, 8),
    [ticker, compareTicker]
  );
  const quotesQuery = useQuotesBatch(symbols, { intervalMs: 30_000 });
  const quotesBySymbol = quotesQuery.data ?? {};

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <div className="flex items-center gap-2 text-text-primary">
          <Activity size={16} />
          <h3 className="intel-title">Live Monitor</h3>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Streaming snapshot across key symbols for fast market pulse checks.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {symbols.map((symbol) => (
          <LiveTickerCard
            key={symbol}
            symbol={symbol}
            quote={quotesBySymbol[symbol]}
            loading={quotesQuery.isLoading && !quotesBySymbol[symbol]}
          />
        ))}
      </div>
    </section>
  );
}
