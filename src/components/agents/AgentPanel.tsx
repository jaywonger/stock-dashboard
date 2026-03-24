/**
 * Agent Panel Component
 *
 * Displays AI-powered stock analysis including:
 * - Recommendation with confidence
 * - Entry/target/stop prices
 * - Technical analysis summary
 * - Checklist
 * - Risks and catalysts
 */

import { useEffect, useState } from "react";
import { analyzeStock, getAgentStatus } from "../../services/agentService";
import type { StockAnalysis, Recommendation } from "../../types";

interface AgentPanelProps {
  symbol: string;
  timeframe?: string;
}

const recommendationColors: Record<Recommendation, string> = {
  STRONG_BUY: "bg-bullish text-white",
  BUY: "bg-green-600 text-white",
  HOLD: "bg-neutral text-white",
  SELL: "bg-bearish/80 text-white",
  STRONG_SELL: "bg-red-700 text-white",
};

const trendColors: Record<"BULLISH" | "BEARISH" | "NEUTRAL", string> = {
  BULLISH: "text-bullish",
  BEARISH: "text-bearish",
  NEUTRAL: "text-text-muted",
};

export function AgentPanel({ symbol, timeframe = "1D" }: AgentPanelProps) {
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentEnabled, setAgentEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetch() {
      setLoading(true);
      setError(null);

      // Check if agent is enabled
      const status = await getAgentStatus();
      if (!mounted) return;

      if (!status?.enabled) {
        setAgentEnabled(false);
        setLoading(false);
        return;
      }

      setAgentEnabled(true);

      const result = await analyzeStock(symbol, timeframe);
      if (!mounted) return;

      if (result === null) {
        setError("Unable to fetch AI analysis, please check API configuration");
      } else {
        setAnalysis(result);
      }
      setLoading(false);
    }

    fetch();
    return () => {
      mounted = false;
    };
  }, [symbol, timeframe]);

  if (agentEnabled === false) {
    return (
      <div className="card flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-2xl">🤖</div>
        <h3 className="text-lg font-semibold text-text-primary">AI Smart Analysis</h3>
        <p className="mt-2 text-sm text-text-muted">
          Configure AI API keys to enable intelligent analysis
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Supports Gemini, Claude, OpenAI and more
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral border-t-transparent" />
          <span className="text-sm text-text-muted">AI is analyzing...</span>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral" />
          <div className="h-20 w-full animate-pulse rounded bg-neutral" />
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">AI Analysis</h3>
        <p className="text-sm text-bearish">{error || "Analysis failed"}</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">AI Smart Analysis</h3>
          <p className="text-xs text-text-muted">{analysis.timestamp.slice(0, 16).replace("T", " ")}</p>
        </div>
        <div className={`rounded px-2 py-1 text-xs font-bold ${recommendationColors[analysis.recommendation]}`}>
          {getRecommendationLabel(analysis.recommendation)}
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 rounded-lg bg-neutral/30 p-3">
        <p className="text-sm text-text-primary">{analysis.summary}</p>
      </div>

      {/* Price Levels */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded border border-border bg-base p-2 text-center">
          <div className="text-xs text-text-muted">Entry Zone</div>
          <div className="text-sm font-semibold text-text-primary">
            ${analysis.entryPrice.low.toFixed(2)} - ${analysis.entryPrice.high.toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-bullish/30 bg-bullish/5 p-2 text-center">
          <div className="text-xs text-bullish">Target</div>
          <div className="text-sm font-semibold text-bullish">
            ${analysis.targetPrice.toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-bearish/30 bg-bearish/5 p-2 text-center">
          <div className="text-xs text-bearish">Stop Loss</div>
          <div className="text-sm font-semibold text-bearish">
            ${analysis.stopLoss.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Risk/Reward */}
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="text-text-muted">Risk/Reward:</span>
        <span className={`font-medium ${analysis.riskRewardRatio > 2 ? "text-bullish" : "text-text-muted"}`}>
          1:{analysis.riskRewardRatio.toFixed(2)}
        </span>
      </div>

      {/* Technical Analysis */}
      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Technical Analysis</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-text-muted">Trend:</span>{" "}
            <span className={`font-medium ${trendColors[analysis.technicalAnalysis.trend]}`}>
              {analysis.technicalAnalysis.trend}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Momentum:</span>{" "}
            <span className="font-medium text-text-primary">
              {analysis.technicalAnalysis.momentum.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Moving Avg:</span>{" "}
            <span className={`font-medium ${trendColors[analysis.technicalAnalysis.maAlignment === "BULLISH" ? "BULLISH" : analysis.technicalAnalysis.maAlignment === "BEARISH" ? "BEARISH" : "NEUTRAL"]}`}>
              {analysis.technicalAnalysis.maAlignment}
            </span>
          </div>
          <div>
            <span className="text-text-muted">RSI:</span>{" "}
            <span className="font-medium text-text-primary">
              {analysis.technicalAnalysis.rsiLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Checklist</h4>
        <div className="space-y-1">
          {analysis.checklist.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-text-primary">{item.item}</span>
              <StatusBadge status={item.status} note={item.note} />
            </div>
          ))}
        </div>
      </div>

      {/* Risks */}
      {analysis.risks.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold text-bearish">Risk Factors</h4>
          <ul className="list-inside list-disc text-xs text-text-muted">
            {analysis.risks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Catalysts */}
      {analysis.catalysts.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-bullish">Potential Catalysts</h4>
          <ul className="list-inside list-disc text-xs text-text-muted">
            {analysis.catalysts.map((catalyst, idx) => (
              <li key={idx}>{catalyst}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function getRecommendationLabel(rec: Recommendation): string {
  const labels: Record<Recommendation, string> = {
    STRONG_BUY: "Strong Buy",
    BUY: "Buy",
    HOLD: "Hold",
    SELL: "Sell",
    STRONG_SELL: "Strong Sell",
  };
  return labels[rec];
}

function StatusBadge({ status, note }: { status: string; note?: string }) {
  const colors: Record<string, string> = {
    Met: "bg-bullish/20 text-bullish",
    Caution: "bg-warning/20 text-warning",
    "Not Met": "bg-bearish/20 text-bearish"
  };

  const labels: Record<string, string> = {
    Met: "Met",
    Caution: "Caution",
    "Not Met": "Not Met"
  };

  return (
    <div className="flex items-center gap-1">
      <span className={`rounded px-1.5 py-0.5 ${colors[status] || "bg-neutral"}`}>{labels[status] || status}</span>
      {note && <span className="text-xs text-text-muted" title={note}>i</span>}
    </div>
  );
}
