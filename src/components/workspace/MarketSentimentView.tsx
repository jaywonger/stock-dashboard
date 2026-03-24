import { useMemo } from "react";
import { SentimentSummary } from "../news/SentimentSummary";
import { useNews } from "../../hooks/useNews";
import { useMacro } from "../../hooks/useMacro";
import { useNewsStore } from "../../store/newsStore";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function MarketSentimentView() {
  const query = useNews();
  const macroQuery = useMacro();
  const { summary, activeSources, lastUpdatedAt } = useNewsStore();

  const scenarios = useMemo(() => {
    const score = summary.overallScore;
    const bullRaw = score;
    const bearRaw = 100 - score;
    const baseRaw = Math.max(10, 80 - Math.abs(score - 50) * 1.2);
    const total = bullRaw + bearRaw + baseRaw;
    const bull = Math.round((bullRaw / total) * 100);
    const bear = Math.round((bearRaw / total) * 100);
    const base = clamp(100 - bull - bear, 5, 90);

    return [
      {
        key: "bull",
        title: "Bull Case",
        probability: bull,
        tone: "bg-bullish",
        text:
          "Risk appetite improves if macro pressure eases and leadership breadth expands. Focus on breakout confirmation and relative strength leaders."
      },
      {
        key: "base",
        title: "Base Case",
        probability: base,
        tone: "bg-[#4d9fff]",
        text:
          "Range-bound action remains likely while rates, earnings revisions, and geopolitics balance each other. Prioritize disciplined entries and tighter risk."
      },
      {
        key: "bear",
        title: "Bear Case",
        probability: bear,
        tone: "bg-bearish",
        text:
          "Downside risk grows if yields rise and negative headlines accelerate. Respect stop-losses and avoid chasing weak momentum."
      }
    ];
  }, [summary.overallScore]);

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="intel-chip">Market Sentiment</span>
          <span className="intel-chip">Composite {summary.overallScore}/100</span>
          <span className="intel-chip">{query.isLoading ? "Syncing" : query.isError ? "Degraded" : "Live Context"}</span>
          <span className="intel-chip">{activeSources.length ? `${activeSources.length} Sources` : "Fallback Mode"}</span>
          {lastUpdatedAt && <span className="intel-chip">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</span>}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
        <SentimentSummary summary={summary} />
        <div className="card p-3">
          <h3 className="intel-title mb-2">Macro Pulse (FRED)</h3>
          {macroQuery.isLoading && <p className="mb-3 text-xs text-text-muted">Loading Federal Reserve indicators...</p>}
          {macroQuery.isError && (
            <p className="mb-3 rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
              Unable to load FRED indicators. Set `FRED_API_KEY` in your `.env` and restart the API server.
            </p>
          )}
          {!macroQuery.isLoading && !macroQuery.isError && (
            <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {macroQuery.data?.indicators.map((item) => (
                <div key={item.key} className="rounded border border-border bg-panel p-2">
                  <p className="text-[11px] uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="ticker-font text-base font-semibold text-text-primary">
                    {item.value === null ? "N/A" : `${item.value.toFixed(2)}${item.unit ? ` ${item.unit}` : ""}`}
                  </p>
                  <p
                    className={`text-xs ${
                      item.change === null ? "text-text-muted" : item.change >= 0 ? "text-bullish" : "text-bearish"
                    }`}
                  >
                    {item.change === null
                      ? "No delta"
                      : `${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)} (${item.changePct?.toFixed(2) ?? "0.00"}%)`}
                  </p>
                  <p className="text-[11px] text-text-subtle">
                    {item.asOf ? `As of ${item.asOf}` : "Date unavailable"} | {item.seriesId}
                  </p>
                </div>
              ))}
            </div>
          )}

          <h3 className="intel-title mb-3">Scenario Matrix</h3>
          {query.isLoading && <p className="text-xs text-text-muted">Loading sentiment context...</p>}
          {query.isError && (
            <p className="mb-3 rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
              Live news sentiment fetch timed out. Showing fallback composite sentiment.
            </p>
          )}
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <div key={scenario.key} className="rounded border border-border bg-panel p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold text-text-primary">{scenario.title}</h4>
                  <span className="ticker-font text-xl font-semibold text-text-primary">{scenario.probability}%</span>
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded bg-[#172033]">
                  <div className={`h-full ${scenario.tone}`} style={{ width: `${scenario.probability}%` }} />
                </div>
                <p className="text-sm text-text-muted">{scenario.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
