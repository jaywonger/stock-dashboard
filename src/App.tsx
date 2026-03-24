import React, { useEffect, useMemo, useState } from "react";
import { Header } from "./components/layout/Header";
import { RightPanel } from "./components/layout/RightPanel";
import { IndicatorControls } from "./components/chart/IndicatorControls";
import { MainChart } from "./components/chart/MainChart";
import { SettingsModal } from "./components/shared/SettingsModal";
import { Toast, type ToastMessage } from "./components/shared/Toast";
import { AgentPanel } from "./components/agents/AgentPanel";
import { DailyDecisionCard } from "./components/news/DailyDecisionCard";
import { WatchlistScreenerPanel } from "./components/dashboard/WatchlistScreenerPanel";
import { WorkspaceTabs, type WorkspaceTabId } from "./components/workspace/WorkspaceTabs";
import { CarlaSetupView } from "./components/workspace/CarlaSetupView";
import { NewsAnalysisView } from "./components/workspace/NewsAnalysisView";
import { MarketSentimentView } from "./components/workspace/MarketSentimentView";
import { LiveMonitorView } from "./components/workspace/LiveMonitorView";
import { CompareView } from "./components/workspace/CompareView";
import { useMarketStore } from "./store/marketStore";
import { useSettingsStore } from "./store/settingsStore";
import type { ChartType, Timeframe } from "./types";

function ErrorFallback({ title }: { title: string }) {
  return (
    <div className="card flex h-full items-center justify-center p-3 text-sm text-bearish">
      {title} failed to render. Reload the page or check your data source settings.
    </div>
  );
}

class PanelErrorBoundary extends React.Component<{ title: string; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { title: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) return <ErrorFallback title={this.props.title} />;
    return this.props.children;
  }
}

type MobileTab = "left" | "main" | "right";

function App() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [activeIndicators, setActiveIndicators] = useState<string[]>(["SMA", "EMA", "VWAP"]);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabId>("dashboard");
  const [mobileTab, setMobileTab] = useState<MobileTab>("main");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [showAgentPanel, setShowAgentPanel] = useState(false);

  const selectedTicker = useMarketStore((state) => state.selectedTicker);
  const compareTicker = useMarketStore((state) => state.compareTicker);
  const setCompareTicker = useMarketStore((state) => state.setCompareTicker);
  const setAlerts = useMarketStore((state) => state.setAlerts);
  const settings = useSettingsStore();

  const showSetupBanner = useMemo(
    () =>
      !settings.keys.polygonApiKey &&
      !settings.keys.alphaVantageApiKey &&
      !settings.keys.finnhubApiKey &&
      !settings.keys.newsApiKey &&
      !settings.keys.benzingaApiKey,
    [settings.keys]
  );

  const dismissToast = (id: string) => setToasts((items) => items.filter((item) => item.id !== id));
  const addToast = (title: string, tone: ToastMessage["tone"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, title, tone }]);
    window.setTimeout(() => dismissToast(id), 4000);
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
      const index = Number(event.key);
      if (index >= 1 && index <= 8) {
        const frames: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M"];
        setTimeframe(frames[index - 1]);
      }
      if (event.key.toLowerCase() === "n") setIsRightCollapsed((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!settings.notificationEnabled || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [settings.notificationEnabled]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/alerts/check");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          alerts: ReturnType<typeof useMarketStore.getState>["alerts"];
          triggered: ReturnType<typeof useMarketStore.getState>["alerts"];
        };
        setAlerts(payload.alerts);
        payload.triggered.forEach((alert) => {
          addToast(`${alert.symbol} ${alert.direction} ${alert.targetPrice}`, "warning");
          if (settings.notificationEnabled && Notification.permission === "granted") {
            new Notification("Stock Alert Triggered", {
              body: `${alert.symbol} moved ${alert.direction} ${alert.targetPrice}`
            });
          }
        });
      } catch {
        // Ignore transient alert polling errors.
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [settings.notificationEnabled, setAlerts]);

  return (
    <div className="flex h-dvh flex-col bg-base text-text-primary">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleLeft={() => {}}
        onToggleRight={() => setIsRightCollapsed((value) => !value)}
        onToggleAgentPanel={() => setShowAgentPanel((value) => !value)}
      />

      {showSetupBanner && (
        <div className="border-b border-warning/35 bg-warning/10 px-4 py-2 text-sm text-warning">
          Running in zero-config mode with mock market data. Add API keys in Settings for live feeds.
        </div>
      )}
      <WorkspaceTabs activeTab={activeWorkspaceTab} onChange={setActiveWorkspaceTab} />

      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 p-3">
          {activeWorkspaceTab === "dashboard" && (
            <PanelErrorBoundary title="Dashboard Workspace">
              <IndicatorControls
                ticker={selectedTicker}
                timeframe={timeframe}
                chartType={chartType}
                activeIndicators={activeIndicators}
                onTickerChange={(ticker) => useMarketStore.getState().setSelectedTicker(ticker)}
                onTimeframeChange={setTimeframe}
                onChartTypeChange={setChartType}
                onIndicatorsChange={setActiveIndicators}
                onCompare={setCompareTicker}
              />
              <div className="flex h-[calc(100%-52px)] flex-col gap-3">
                <div className="grid min-h-0 flex-[1.1] gap-3 xl:grid-cols-[1.6fr_0.9fr]">
                  <MainChart
                    ticker={selectedTicker}
                    timeframe={timeframe}
                    chartType={chartType}
                    compareTicker={compareTicker}
                    activeIndicators={activeIndicators}
                  />
                  <div className="min-h-0 overflow-y-auto">
                    <DailyDecisionCard ticker={selectedTicker} timeframe={timeframe} />
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <WatchlistScreenerPanel />
                </div>
              </div>
            </PanelErrorBoundary>
          )}

          {activeWorkspaceTab === "carla-setup" && (
            <PanelErrorBoundary title="Carla Setup">
              <CarlaSetupView />
            </PanelErrorBoundary>
          )}

          {activeWorkspaceTab === "news-analysis" && (
            <PanelErrorBoundary title="News Analysis">
              <NewsAnalysisView ticker={selectedTicker} timeframe={timeframe} />
            </PanelErrorBoundary>
          )}

          {activeWorkspaceTab === "market-sentiment" && (
            <PanelErrorBoundary title="Market Sentiment">
              <MarketSentimentView />
            </PanelErrorBoundary>
          )}

          {activeWorkspaceTab === "live-monitor" && (
            <PanelErrorBoundary title="Live Monitor">
              <LiveMonitorView ticker={selectedTicker} compareTicker={compareTicker} />
            </PanelErrorBoundary>
          )}

          {activeWorkspaceTab === "compare" && (
            <PanelErrorBoundary title="Compare">
              <CompareView
                primaryTicker={selectedTicker}
                compareTicker={compareTicker}
                timeframe={timeframe}
                onCompareChange={setCompareTicker}
              />
            </PanelErrorBoundary>
          )}
        </section>

        {!isMobile && activeWorkspaceTab === "dashboard" && <RightPanel collapsed={isRightCollapsed} />}

      {/* AI Agent Panel Drawer */}
      {showAgentPanel && !isMobile && (
        <div className="fixed right-0 top-[65px] z-30 w-[380px] border-l border-border bg-base shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="font-semibold text-text-primary">AI Smart Analysis</h3>
            </div>
            <button
              onClick={() => setShowAgentPanel(false)}
              className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary"
            >
              Close
            </button>
          </div>
          <div className="h-[calc(100dvh-113px)] overflow-y-auto p-4">
            <AgentPanel symbol={selectedTicker} timeframe={timeframe} />
          </div>
        </div>
      )}
      </main>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-base px-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              className={`rounded border px-2 py-1 ${mobileTab === "left" ? "border-neutral text-neutral" : "border-border text-text-muted"}`}
              onClick={() => setMobileTab("left")}
            >
              Watchlists
            </button>
            <button
              className={`rounded border px-2 py-1 ${mobileTab === "main" ? "border-neutral text-neutral" : "border-border text-text-muted"}`}
              onClick={() => setMobileTab("main")}
            >
              Chart
            </button>
            <button
              className={`rounded border px-2 py-1 ${mobileTab === "right" ? "border-neutral text-neutral" : "border-border text-text-muted"}`}
              onClick={() => setMobileTab("right")}
            >
              News
            </button>
          </div>
          <div className="mt-2 max-h-[55dvh] overflow-y-auto">
            {mobileTab === "left" && <WatchlistScreenerPanel />}
            {mobileTab === "main" && (
              <div className="space-y-2">
                <MainChart
                  ticker={selectedTicker}
                  timeframe={timeframe}
                  chartType={chartType}
                  compareTicker={compareTicker}
                  activeIndicators={activeIndicators}
                />
                <DailyDecisionCard ticker={selectedTicker} timeframe={timeframe} />
                <WatchlistScreenerPanel />
              </div>
            )}
            {mobileTab === "right" && <RightPanel collapsed={false} />}
          </div>
        </nav>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toast toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

export default App;
