import { useOpenInsider } from "../../hooks/useOpenInsider";
import { Skeleton } from "../shared/Skeleton";

interface OpenInsiderCardProps {
  ticker: string;
}

export function OpenInsiderCard({ ticker }: OpenInsiderCardProps) {
  const query = useOpenInsider(ticker);

  if (query.isLoading) {
    return (
      <section className="card mb-3 p-3">
        <Skeleton className="mb-2 h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="card mb-3 p-3">
        <h3 className="intel-title">OpenInsider</h3>
        <p className="mt-2 text-xs text-text-muted">No insider filing summary available for {ticker} right now.</p>
      </section>
    );
  }

  const data = query.data;
  const netTone =
    data.signal === "bullish"
      ? "text-bullish"
      : data.signal === "bearish"
        ? "text-bearish"
        : "text-warning";

  return (
    <section className="card mb-3 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="intel-title">OpenInsider</h3>
        <span className={`rounded border border-border px-2 py-0.5 text-[10px] font-semibold uppercase ${netTone}`}>
          {data.signal}
        </span>
      </div>
      <p className="mb-2 text-xs text-text-subtle">{data.summary}</p>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted">
        <div className="rounded border border-border bg-surface p-2">
          <div>Buys</div>
          <div className="font-medium text-text-primary">
            {data.buyCount} | ${data.buyValue.toLocaleString()}
          </div>
        </div>
        <div className="rounded border border-border bg-surface p-2">
          <div>Sells</div>
          <div className="font-medium text-text-primary">
            {data.sellCount} | ${data.sellValue.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-text-muted">
        Net: <span className={`font-semibold ${netTone}`}>${data.netValue.toLocaleString()}</span> | Confidence {data.confidence}%
      </div>
      <div className="mt-1 text-[11px] text-text-muted">
        <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-neutral hover:underline">
          View filings on OpenInsider
        </a>
      </div>
    </section>
  );
}
