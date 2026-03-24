import type { AnalystRole, AnalystStance, NewsTeamAnalysisReport } from "../../types";
import { Skeleton } from "../shared/Skeleton";

const roleLabel: Record<AnalystRole, string> = {
  "market-analyst": "Market Analyst",
  "sentiment-analyst": "Sentiment Analyst",
  "news-analyst": "News Analyst",
  "fundamentals-analyst": "Fundamentals Analyst"
};

const stanceTone: Record<AnalystStance, string> = {
  bullish: "text-bullish border-bullish/25 bg-bullish/10",
  neutral: "text-warning border-warning/25 bg-warning/10",
  bearish: "text-bearish border-bearish/25 bg-bearish/10"
};

interface TeamDebateCardProps {
  isLoading: boolean;
  isError: boolean;
  data?: NewsTeamAnalysisReport;
}

export function TeamDebateCard({ isLoading, isError, data }: TeamDebateCardProps) {
  if (isLoading) {
    return (
      <section className="card p-3">
        <Skeleton className="mb-2 h-5 w-1/2" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="card p-3">
        <h3 className="intel-title">Analyst Team Debate</h3>
        <p className="mt-2 text-xs text-bearish">Unable to generate team-based news analysis.</p>
      </section>
    );
  }

  return (
    <section className="card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="intel-title">Analyst Team Debate</h3>
        <span className="intel-chip">{data.ticker}</span>
        <span className="intel-chip">Analysis Date {data.analysisDate}</span>
        <span className="intel-chip">{data.rounds} Rounds</span>
      </div>

      <div className="mb-3 rounded border border-border bg-surface p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Final Verdict</span>
          <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${stanceTone[data.finalVerdict.stance]}`}>
            {data.finalVerdict.stance}
          </span>
        </div>
        <p className="text-xs text-text-muted">{data.finalVerdict.rationale}</p>
        <p className="mt-1 text-xs text-text-subtle">Confidence {data.finalVerdict.confidence}%</p>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-2">
        {data.team.map((analyst) => (
          <div key={analyst.role} className="rounded border border-border bg-surface p-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-text-primary">{roleLabel[analyst.role]}</p>
              <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${stanceTone[analyst.stance]}`}>
                {analyst.stance}
              </span>
            </div>
            <p className="text-xs text-text-muted">{analyst.reasoning}</p>
            <p className="mt-1 text-[11px] text-text-subtle">Confidence {analyst.confidence}%</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.debate.map((round) => (
          <div key={round.round} className="rounded border border-border bg-[#0f1625] p-2">
            <p className="mb-1 text-xs font-semibold text-text-primary">Round {round.round}</p>
            <p className="text-xs text-text-muted">{round.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

