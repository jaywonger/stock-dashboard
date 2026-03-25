/**
 * Right Panel with Tabs
 *
 * Tabs:
 * - News: Financial news feed
 * - AI: Chat agent for Q&A
 * - Monitor: Autonomous monitoring alerts
 */

import { useState } from "react";
import { NewsFeed } from "../news/NewsFeed";
import { ChatAgent } from "../agents/ChatAgent";
import { MonitorAgent } from "../agents/MonitorAgent";
import { useWatchlists } from "../../hooks/useWatchlists";
import { useMarketStore } from "../../store/marketStore";

type RightPanelTab = "news" | "ai" | "monitor";

interface RightPanelProps {
  collapsed: boolean;
}

export function RightPanel({ collapsed }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("news");
  const selectedTicker = useMarketStore((state) => state.selectedTicker);
  const activeWatchlistId = useMarketStore((state) => state.activeWatchlistId);
  const watchlistsQuery = useWatchlists();
  const watchlists = watchlistsQuery.data ?? [];
  const activeWatchlist = watchlists.find((item) => item.id === activeWatchlistId) ?? watchlists[0] ?? null;
  const watchlistSymbols = activeWatchlist?.items.map((item) => item.symbol) ?? [];
  const watchlist = Array.from(new Set([selectedTicker, ...watchlistSymbols]));

  if (collapsed) return null;

  return (
    <aside className="flex h-full w-[400px] flex-col border-l border-border">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <TabButton
          label="News"
          icon="📰"
          active={activeTab === "news"}
          onClick={() => setActiveTab("news")}
        />
        <TabButton
          label="AI Chat"
          icon="🤖"
          active={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
        />
        <TabButton
          label="Monitor"
          icon="🔔"
          active={activeTab === "monitor"}
          onClick={() => setActiveTab("monitor")}
          badge={watchlist.length > 0 ? watchlist.length : undefined}
        />
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-hidden">
        {activeTab === "news" && <NewsFeed />}
        {activeTab === "ai" && <ChatAgent />}
        {activeTab === "monitor" && <MonitorAgent watchlist={watchlist} />}
      </div>
    </aside>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? "bg-neutral text-white"
          : "text-text-muted hover:bg-neutral/10 hover:text-text-primary"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 rounded-full bg-bullish px-1.5 py-0.5 text-[10px] text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
