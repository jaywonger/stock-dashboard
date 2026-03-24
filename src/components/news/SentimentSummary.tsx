import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SentimentSummary as SentimentSummaryType } from "../../types";
import { SentimentGauge } from "./SentimentGauge";

interface SentimentSummaryProps {
  summary: SentimentSummaryType;
}

export function SentimentSummary({ summary }: SentimentSummaryProps) {
  return (
    <div className="card p-3">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">Market Sentiment</h3>
      <SentimentGauge score={summary.overallScore} />

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="rounded border border-border bg-panel p-2">
          <h4 className="mb-1 text-xs uppercase text-text-muted">Top Bullish</h4>
          {summary.topBullish.length === 0 && <p className="text-xs text-text-muted">No bullish leaders yet</p>}
          {summary.topBullish.map((item) => (
            <div key={item.symbol} className="flex items-center justify-between text-xs">
              <span className="ticker-font text-text-primary">{item.symbol}</span>
              <span className="ticker-font text-bullish">{item.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="rounded border border-border bg-panel p-2">
          <h4 className="mb-1 text-xs uppercase text-text-muted">Top Bearish</h4>
          {summary.topBearish.length === 0 && <p className="text-xs text-text-muted">No bearish leaders yet</p>}
          {summary.topBearish.map((item) => (
            <div key={item.symbol} className="flex items-center justify-between text-xs">
              <span className="ticker-font text-text-primary">{item.symbol}</span>
              <span className="ticker-font text-bearish">{item.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded border border-border bg-panel p-2">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-text-muted">
          <span>7D News Sentiment Trend</span>
          <span>-1 Bear | 0 Neutral | +1 Bull</span>
        </div>
        <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={summary.trend}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#8c94a7", fontSize: 10 }}
              tickFormatter={(value: string) => value.slice(5)}
              minTickGap={24}
              axisLine={{ stroke: "#1e2330" }}
              tickLine={{ stroke: "#1e2330" }}
            />
            <YAxis
              domain={[-1, 1]}
              ticks={[-1, 0, 1]}
              width={22}
              tick={{ fill: "#8c94a7", fontSize: 10 }}
              axisLine={{ stroke: "#1e2330" }}
              tickLine={{ stroke: "#1e2330" }}
            />
            <Tooltip
              contentStyle={{
                background: "#111318",
                border: "1px solid #1e2330",
                color: "#e8edf7",
                fontSize: 12
              }}
            />
            <Line type="monotone" dataKey="score" stroke="#4d9fff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
