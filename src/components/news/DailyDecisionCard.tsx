import type { ChecklistStatus, Timeframe } from "../../types";
import { useDailyAnalysis } from "../../hooks/useDailyAnalysis";
import { Skeleton } from "../shared/Skeleton";

interface DailyDecisionCardProps {
  ticker: string;
  timeframe: Timeframe;
}

const actionTone: Record<string, string> = {
  buy: "text-bullish border-bullish/35 bg-bullish/10",
  hold: "text-warning border-warning/35 bg-warning/10",
  sell: "text-bearish border-bearish/35 bg-bearish/10"
};

const checklistTone: Record<ChecklistStatus, string> = {
  pass: "text-bullish",
  watch: "text-warning",
  fail: "text-bearish"
};

const checklistLabel: Record<ChecklistStatus, string> = {
  pass: "Pass",
  watch: "Watch",
  fail: "Not met"
};

export function DailyDecisionCard({ ticker, timeframe }: DailyDecisionCardProps) {
  const query = useDailyAnalysis(ticker, timeframe);

  if (query.isLoading) {
    return (
      <section className="card mb-3 p-3">
        <Skeleton className="mb-2 h-5 w-2/3" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="card mb-3 p-3">
        <h3 className="text-sm font-semibold text-text-primary">Daily Decision Dashboard</h3>
        <p className="mt-2 text-xs text-bearish">Could not generate AI decision analysis for {ticker}.</p>
      </section>
    );
  }

  const data = query.data;
  return (
    <section className="card mb-3 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="intel-title">Daily Decision</h3>
        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${actionTone[data.action]}`}>
          {data.action}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {data.aiProvider && <span className="intel-chip">AI {data.aiProvider}</span>}
        <span className="intel-chip">Sentiment {data.sentiment.overallScore}/100</span>
        {data.insiderActivity && (
          <span className="intel-chip">
            Insider {data.insiderActivity.signal} ({data.insiderActivity.tradesFound})
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-text-muted">{data.conclusion}</p>

      {data.aiCommentary ? (
        <p className="mb-3 text-xs text-text-subtle">{data.aiCommentary}</p>
      ) : (
        <p className="mb-3 text-xs text-text-subtle">
          AI commentary unavailable for this run. Decision signals are still computed from price action and sentiment.
        </p>
      )}

      {data.insiderActivity && (
        <p className="mb-3 text-xs text-text-subtle">
          {data.insiderActivity.summary} Source:{" "}
          <a href={data.insiderActivity.sourceUrl} target="_blank" rel="noreferrer" className="text-neutral hover:underline">
            OpenInsider
          </a>
          .
        </p>
      )}

      <div className="mb-2 h-1.5 w-full rounded bg-[#1f2735]">
        <div className="h-1.5 rounded bg-neutral" style={{ width: `${data.confidence}%` }} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
        <div className="rounded border border-border bg-surface p-2">
          <div className="text-text-subtle">Confidence</div>
          <div className="text-sm font-semibold text-text-primary">{data.confidence}%</div>
        </div>
        <div className="rounded border border-border bg-surface p-2">
          <div className="text-text-subtle">Risk</div>
          <div className="text-sm font-semibold capitalize text-text-primary">{data.riskLevel}</div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
        <div className="rounded border border-border bg-surface p-2">
          <div>Entry Zone</div>
          <div className="font-medium text-text-primary">
            {data.levels.entryMin} - {data.levels.entryMax}
          </div>
        </div>
        <div className="rounded border border-border bg-surface p-2">
          <div>Stop Loss</div>
          <div className="font-medium text-text-primary">{data.levels.stopLoss}</div>
        </div>
        <div className="rounded border border-border bg-surface p-2">
          <div>Target 1</div>
          <div className="font-medium text-text-primary">{data.levels.target1}</div>
        </div>
        <div className="rounded border border-border bg-surface p-2">
          <div>Target 2</div>
          <div className="font-medium text-text-primary">{data.levels.target2}</div>
        </div>
      </div>

      <div className="mb-1 text-[10px] uppercase tracking-wide text-text-subtle">
        Signal Checklist (Not met = condition failed, not app error)
      </div>
      <div className="space-y-1">
        {data.checklist.map((item) => (
          <div key={item.label} className="rounded border border-border bg-surface px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-primary">{item.label}</span>
              <span className={`font-semibold uppercase ${checklistTone[item.status]}`}>{checklistLabel[item.status]}</span>
            </div>
            <div className="mt-0.5 text-text-subtle">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
