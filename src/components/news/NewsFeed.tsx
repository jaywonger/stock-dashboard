import { useMemo } from "react";
import { useNews } from "../../hooks/useNews";
import { useNewsStore } from "../../store/newsStore";
import { useMarketStore } from "../../store/marketStore";
import { Skeleton } from "../shared/Skeleton";
import { ArticleCard } from "./ArticleCard";
import { SentimentSummary } from "./SentimentSummary";

export function NewsFeed() {
  const selectedTicker = useMarketStore((state) => state.selectedTicker);
  const {
    articles,
    sentimentFilter,
    tickerFilter,
    summary,
    activeSources,
    setSentimentFilter,
    setTickerFilter
  } = useNewsStore();
  const query = useNews(tickerFilter ?? undefined);

  const filtered = useMemo(
    () =>
      articles.filter((article) => {
        if (sentimentFilter !== "all" && article.sentimentLabel !== sentimentFilter) return false;
        if (tickerFilter && article.ticker !== tickerFilter) return false;
        return true;
      }),
    [articles, sentimentFilter, tickerFilter]
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <SentimentSummary summary={summary} />

      <div className="card p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {(["all", "bullish", "bearish", "neutral"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSentimentFilter(filter)}
              className={`rounded border px-2 py-1 text-xs ${
                sentimentFilter === filter
                  ? "border-neutral bg-neutral/10 text-neutral"
                  : "border-border text-text-muted hover:text-text-primary"
              }`}
            >
              {filter}
            </button>
          ))}
          <button
            onClick={() => setTickerFilter(tickerFilter ? null : selectedTicker)}
            className={`rounded border px-2 py-1 text-xs ${
              tickerFilter ? "border-bullish bg-bullish/10 text-bullish" : "border-border text-text-muted"
            }`}
          >
            {tickerFilter ? `Ticker: ${tickerFilter}` : "Filter selected ticker"}
          </button>
        </div>

        {query.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {query.isError && (
          <div className="rounded border border-bearish/30 bg-bearish/10 p-2 text-xs text-bearish">
            Failed to load news feed.
          </div>
        )}
        {!query.isLoading && activeSources.length === 0 && (
          <div className="rounded border border-border bg-panel p-3 text-xs text-text-muted">
            No news sources configured. Open Settings and add at least one API key or RSS feed URL.
          </div>
        )}
        {!query.isLoading && activeSources.length > 0 && filtered.length === 0 && (
          <div className="rounded border border-border bg-panel p-3 text-xs text-text-muted">
            No matching articles. Try changing sentiment filter or ticker scope.
          </div>
        )}

        <div className="max-h-[48dvh] space-y-2 overflow-y-auto">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
