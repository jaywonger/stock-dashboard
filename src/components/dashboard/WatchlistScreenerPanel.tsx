import { useState } from "react";
import { ScreenerConfig } from "../screener/ScreenerConfig";
import { ScreenerResults } from "../screener/ScreenerResults";
import { WatchlistManager } from "../watchlist/WatchlistManager";

type PanelTab = "watchlist" | "screener";

export function WatchlistScreenerPanel() {
  const [tab, setTab] = useState<PanelTab>("screener");

  return (
    <div className="card flex h-full flex-col overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Watchlist + Screener</h2>
        <div className="flex items-center gap-1 rounded border border-border bg-surface p-1 text-xs">
          <button
            className={`rounded px-2 py-1 ${tab === "watchlist" ? "bg-neutral/20 text-text-primary" : "text-text-muted hover:text-text-primary"}`}
            onClick={() => setTab("watchlist")}
          >
            Watchlist
          </button>
          <button
            className={`rounded px-2 py-1 ${tab === "screener" ? "bg-neutral/20 text-text-primary" : "text-text-muted hover:text-text-primary"}`}
            onClick={() => setTab("screener")}
          >
            Screener
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "watchlist" ? (
          <WatchlistManager embedded />
        ) : (
          <div className="grid h-full min-h-0 gap-2 lg:grid-cols-[360px_1fr]">
            <div className="min-h-0 overflow-y-auto rounded border border-border bg-panel p-3">
              <ScreenerConfig embedded />
            </div>
            <div className="min-h-0 rounded border border-border bg-panel">
              <ScreenerResults />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

