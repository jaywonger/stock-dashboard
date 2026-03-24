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

  const macroFactor = useMemo(() => {
    const indicators = macroQuery.data?.indicators ?? [];
    const byKey = new Map(indicators.map((item) => [item.key, item]));
    const bullishReasons: string[] = [];
    const bearishReasons: string[] = [];
    let points = 0;

    const tenYear = byKey.get("tenYearYield");
    const twoYear = byKey.get("twoYearYield");
    const fedFunds = byKey.get("fedFunds");
    const cpi = byKey.get("cpi");
    const unemployment = byKey.get("unemployment");

    if (tenYear?.change !== null && tenYear?.change !== undefined) {
      if (tenYear.change < 0) {
        points += 1.1;
        bullishReasons.push(`10Y yield fell (${tenYear.change.toFixed(2)}), easing discount-rate pressure.`);
      } else if (tenYear.change > 0) {
        points -= 1.1;
        bearishReasons.push(`10Y yield rose (+${tenYear.change.toFixed(2)}), tightening valuation conditions.`);
      }
    }

    if (twoYear?.change !== null && twoYear?.change !== undefined) {
      if (twoYear.change < 0) {
        points += 0.9;
        bullishReasons.push(`2Y yield declined (${twoYear.change.toFixed(2)}), supportive for risk appetite.`);
      } else if (twoYear.change > 0) {
        points -= 0.9;
        bearishReasons.push(`2Y yield increased (+${twoYear.change.toFixed(2)}), signaling tighter policy expectations.`);
      }
    }

    if (fedFunds?.change !== null && fedFunds?.change !== undefined) {
      if (fedFunds.change < 0) {
        points += 1.0;
        bullishReasons.push(`Fed Funds moved lower (${fedFunds.change.toFixed(2)}), improving funding backdrop.`);
      } else if (fedFunds.change > 0) {
        points -= 1.0;
        bearishReasons.push(`Fed Funds moved higher (+${fedFunds.change.toFixed(2)}), increasing financing friction.`);
      }
    }

    if (cpi?.change !== null && cpi?.change !== undefined) {
      if (cpi.change < 0) {
        points += 0.8;
        bullishReasons.push(`CPI cooled (${cpi.change.toFixed(2)}), reducing inflation pressure.`);
      } else if (cpi.change > 0) {
        points -= 0.8;
        bearishReasons.push(`CPI accelerated (+${cpi.change.toFixed(2)}), raising policy-tightening risk.`);
      }
    }

    if (unemployment?.change !== null && unemployment?.change !== undefined) {
      if (unemployment.change <= 0) {
        points += 0.6;
        bullishReasons.push(`Unemployment is stable/lower (${unemployment.change.toFixed(2)}), supporting growth resilience.`);
      } else {
        points -= 0.6;
        bearishReasons.push(`Unemployment is rising (+${unemployment.change.toFixed(2)}), pointing to softer labor momentum.`);
      }
    }

    const score = clamp(Math.round(50 + points * 9), 20, 80);
    return {
      score,
      bias: score >= 58 ? "Supportive" : score <= 42 ? "Headwind" : "Neutral",
      bullishReasons,
      bearishReasons
    };
  }, [macroQuery.data?.indicators]);

  const scenarios = useMemo(() => {
    const score = Math.round(summary.overallScore * 0.7 + macroFactor.score * 0.3);
    const trendValues = summary.trend.map((item) => item.score);
    const latestTrend = trendValues.at(-1) ?? 0;
    const previousTrend = trendValues.at(-2) ?? latestTrend;
    const trendDelta = latestTrend - previousTrend;
    const trendLabel =
      trendDelta > 0.03
        ? "improving"
        : trendDelta < -0.03
          ? "deteriorating"
          : "flat";
    const bullishLeaders = summary.topBullish.slice(0, 3).map((item) => item.symbol).join(", ");
    const bearishLeaders = summary.topBearish.slice(0, 3).map((item) => item.symbol).join(", ");

    const bullRaw = score + (macroFactor.score >= 55 ? 6 : 0);
    const bearRaw = 100 - score + (macroFactor.score <= 45 ? 6 : 0);
    const baseRaw = Math.max(12, 84 - Math.abs(score - 50) * 1.2);
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
        text: "Risk assets outperform if macro pressure eases and positive breadth persists.",
        reasons: [
          `News sentiment composite is ${summary.overallScore}/100 with trend ${trendLabel}.`,
          `Macro factor is ${macroFactor.score}/100 (${macroFactor.bias.toLowerCase()}).`,
          bullishLeaders ? `Current bullish leadership: ${bullishLeaders}.` : "Bullish leadership is thin; confirmation is still needed."
        ],
        execution: "Look for continuation breakouts and prioritize relative-strength names above rising moving averages."
      },
      {
        key: "base",
        title: "Base Case",
        probability: base,
        tone: "bg-[#4d9fff]",
        text: "Range-bound price action remains most likely as supportive and restrictive forces offset.",
        reasons: [
          `Composite sentiment (${summary.overallScore}/100) and macro factor (${macroFactor.score}/100) are not decisively aligned.`,
          `News flow shows mixed leadership${bullishLeaders || bearishLeaders ? ` (bull: ${bullishLeaders || "n/a"} | bear: ${bearishLeaders || "n/a"})` : "."}`,
          `Short-term sentiment momentum is ${trendLabel}, favoring tactical entries over aggressive positioning.`
        ],
        execution: "Favor mean-reversion edges inside ranges and tighten invalidation levels until trend confirmation appears."
      },
      {
        key: "bear",
        title: "Bear Case",
        probability: bear,
        tone: "bg-bearish",
        text: "Downside pressure grows if rates stay firm and negative headlines broaden.",
        reasons: [
          `Bear case strengthens when macro stays restrictive (current macro factor ${macroFactor.score}/100).`,
          bearishLeaders ? `Current bearish leadership: ${bearishLeaders}.` : "Bearish leadership is not dominant yet, so follow-through is key.",
          `If sentiment trend keeps ${trendLabel === "deteriorating" ? "deteriorating" : "rolling over"}, probability of risk-off rotation rises.`
        ],
        execution: "Reduce exposure into failed rebounds, avoid weak breakouts, and enforce tighter stop-loss discipline."
      }
    ];
  }, [macroFactor.bias, macroFactor.score, summary.overallScore, summary.topBearish, summary.topBullish, summary.trend]);

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="intel-chip">Market Sentiment</span>
          <span className="intel-chip">Composite {summary.overallScore}/100</span>
          <span className="intel-chip">Macro Factor {macroFactor.score}/100 ({macroFactor.bias})</span>
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
          {!macroQuery.isError && (
            <div className="mb-3 rounded border border-border bg-[#0f1625] p-2">
              <h4 className="mb-1 text-xs uppercase tracking-wide text-text-muted">Macro Reasoning</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] text-bullish">Supportive Inputs</p>
                  <ul className="space-y-1 text-xs text-text-muted">
                    {(macroFactor.bullishReasons.length ? macroFactor.bullishReasons : ["No strong supportive macro shifts detected."]).map(
                      (reason) => (
                        <li key={`bull-${reason}`}>- {reason}</li>
                      )
                    )}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-bearish">Restrictive Inputs</p>
                  <ul className="space-y-1 text-xs text-text-muted">
                    {(macroFactor.bearishReasons.length ? macroFactor.bearishReasons : ["No strong restrictive macro shifts detected."]).map(
                      (reason) => (
                        <li key={`bear-${reason}`}>- {reason}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>
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
                <div className="mt-2 rounded border border-border/70 bg-[#0e1523] p-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">Reasoning</p>
                  <ul className="space-y-1 text-xs text-text-muted">
                    {scenario.reasons.map((reason) => (
                      <li key={`${scenario.key}-${reason}`}>- {reason}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-2 text-xs text-text-subtle">
                  <span className="text-text-muted">Execution:</span> {scenario.execution}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
