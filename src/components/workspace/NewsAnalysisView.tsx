import type { Timeframe } from "../../types";
import { useNews } from "../../hooks/useNews";
import { useNewsStore } from "../../store/newsStore";
import { DailyDecisionCard } from "../news/DailyDecisionCard";
import { ArticleCard } from "../news/ArticleCard";
import { Skeleton } from "../shared/Skeleton";

interface NewsAnalysisViewProps {
  ticker: string;
  timeframe: Timeframe;
}

export function NewsAnalysisView({ ticker, timeframe }: NewsAnalysisViewProps) {
  const query = useNews(ticker);
  const { articles } = useNewsStore();
  const topArticles = articles.slice(0, 6);

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="intel-chip">News Analysis</span>
          <span className="intel-chip ticker-font">{ticker}</span>
          <span className="intel-chip">Timeframe {timeframe}</span>
          <span className="intel-chip">{query.isLoading ? "Syncing" : `Articles ${topArticles.length}`}</span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[400px_1fr]">
        <DailyDecisionCard ticker={ticker} timeframe={timeframe} />

        <div className="card p-3">
          <h3 className="intel-title mb-2">Intelligence Feed</h3>
          {query.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {!query.isLoading && topArticles.length === 0 && (
            <div className="rounded border border-border bg-panel p-3 text-xs text-text-muted">
              No news available for {ticker}. Add news APIs in Settings.
            </div>
          )}
          <div className="max-h-[70dvh] space-y-2 overflow-y-auto">
            {topArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
