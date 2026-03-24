import { useEffect, useState } from "react";
import type { Timeframe } from "../../types";
import { useNews } from "../../hooks/useNews";
import { useNewsTeamAnalysis } from "../../hooks/useNewsTeamAnalysis";
import { useNewsStore } from "../../store/newsStore";
import { DailyDecisionCard } from "../news/DailyDecisionCard";
import { ArticleCard } from "../news/ArticleCard";
import { TeamDebateCard } from "../news/TeamDebateCard";
import { Skeleton } from "../shared/Skeleton";

interface NewsAnalysisViewProps {
  ticker: string;
  timeframe: Timeframe;
}

export function NewsAnalysisView({ ticker, timeframe }: NewsAnalysisViewProps) {
  const [analysisTickerInput, setAnalysisTickerInput] = useState(ticker);
  const [analysisTicker, setAnalysisTicker] = useState(ticker);
  const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().slice(0, 10));
  const [debateRounds, setDebateRounds] = useState(3);

  useEffect(() => {
    setAnalysisTickerInput(ticker);
    setAnalysisTicker(ticker);
  }, [ticker]);

  const query = useNews(analysisTicker);
  const teamQuery = useNewsTeamAnalysis(analysisTicker, timeframe, analysisDate, debateRounds);
  const { articles } = useNewsStore();
  const topArticles = articles.slice(0, 6);

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="intel-chip">News Analysis</span>
          <span className="intel-chip ticker-font">{analysisTicker}</span>
          <span className="intel-chip">Timeframe {timeframe}</span>
          <span className="intel-chip">Analysis Date {analysisDate}</span>
          <span className="intel-chip">Debate Rounds {debateRounds}</span>
          <span className="intel-chip">{query.isLoading ? "Syncing" : `Articles ${topArticles.length}`}</span>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[140px_180px_1fr_auto]">
          <input
            value={analysisTickerInput}
            onChange={(event) => setAnalysisTickerInput(event.target.value.toUpperCase())}
            className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary ticker-font"
            placeholder="Ticker"
          />
          <input
            type="date"
            value={analysisDate}
            onChange={(event) => setAnalysisDate(event.target.value)}
            className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary"
          />
          <label className="rounded border border-border bg-base px-2 py-1 text-xs text-text-muted">
            Debate rounds: {debateRounds}
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={debateRounds}
              onChange={(event) => setDebateRounds(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <button
            onClick={() => setAnalysisTicker(analysisTickerInput.trim().toUpperCase() || ticker)}
            className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-text-primary hover:border-neutral"
          >
            Run Analysis
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[440px_1fr]">
        <div className="space-y-3">
          <DailyDecisionCard ticker={analysisTicker} timeframe={timeframe} />
          <TeamDebateCard isLoading={teamQuery.isLoading} isError={teamQuery.isError} data={teamQuery.data} />
        </div>

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
              No news available for {analysisTicker}. Add news APIs in Settings.
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
