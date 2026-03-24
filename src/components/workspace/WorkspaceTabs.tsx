export type WorkspaceTabId = "dashboard" | "carla-setup" | "news-analysis" | "market-sentiment" | "live-monitor" | "compare";

interface WorkspaceTabsProps {
  activeTab: WorkspaceTabId;
  onChange: (tab: WorkspaceTabId) => void;
}

const tabs: Array<{ id: WorkspaceTabId; label: string; live?: boolean }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "carla-setup", label: "Carla's Setup" },
  { id: "news-analysis", label: "News Analysis" },
  { id: "market-sentiment", label: "Market Sentiment" },
  { id: "live-monitor", label: "Live Monitor", live: true },
  { id: "compare", label: "Compare" }
];

export function WorkspaceTabs({ activeTab, onChange }: WorkspaceTabsProps) {
  return (
    <div className="border-b border-border/80 bg-[#060b12]/95 px-3 pb-2 pt-1">
      <div className="monitor-grid rounded-lg border border-border/70 bg-[#0b111a]/65 p-1">
        <div className="flex flex-wrap items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              activeTab === tab.id
                ? "border-neutral/70 bg-neutral/12 text-text-primary shadow-[0_0_18px_rgba(77,159,255,0.18)]"
                : "border-transparent text-text-muted hover:border-border hover:bg-[#101726] hover:text-text-primary"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.live && <span className="inline-block h-2 w-2 rounded-full bg-bullish" />}
              {tab.label}
            </span>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
