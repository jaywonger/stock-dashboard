import type { Timeframe } from "../../types";
import { DailyDecisionCard } from "../news/DailyDecisionCard";
import { NewsFeed } from "../news/NewsFeed";

interface RightPanelProps {
  collapsed: boolean;
  ticker: string;
  timeframe: Timeframe;
}

export function RightPanel({ collapsed, ticker, timeframe }: RightPanelProps) {
  if (collapsed) return null;
  return (
    <aside className="h-full w-[360px] p-3">
      <DailyDecisionCard ticker={ticker} timeframe={timeframe} />
      <NewsFeed />
    </aside>
  );
}
