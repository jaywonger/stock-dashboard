import React, { useEffect, useMemo, useState } from "react";
import { Header } from "./components/layout/Header";
import { RightPanel } from "./components/layout/RightPanel";
import { WatchlistScreenerPanel } from "./components/dashboard/WatchlistScreenerPanel";
import { IndicatorControls } from "./components/chart/IndicatorControls";
import { MainChart } from "./components/chart/MainChart";
import { SettingsModal } from "./components/shared/SettingsModal";
import { Toast, type ToastMessage } from "./components/shared/Toast";
import { CompareView } from "./components/workspace/CompareView";
import { CarlaSetupView } from "./components/workspace/CarlaSetupView";
import { LiveMonitorView } from "./components/workspace/LiveMonitorView";
import { MarketSentimentView } from "./components/workspace/MarketSentimentView";
import { NewsAnalysisView } from "./components/workspace/NewsAnalysisView";
import { WorkspaceTabs, type WorkspaceTabId } from "./components/workspace/WorkspaceTabs";
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
  const [chartHeightPct, setChartHeightPct] = useState(58);
  const [mobileTab, setMobileTab] = useState<MobileTab>("main");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabId>("dashboard");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

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
    <div className="min-h-dvh bg-base text-text-primary">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleLeft={() => undefined}
        onToggleRight={() => setIsRightCollapsed((value) => !value)}
      />
      <WorkspaceTabs activeTab={workspaceTab} onChange={setWorkspaceTab} />

      {showSetupBanner && (
        <div className="border-b border-warning/35 bg-warning/10 px-4 py-2 text-sm text-warning">
          Running in zero-config mode with mock market data. Add API keys in Settings for live feeds.
        </div>
      )}

      <main className="flex h-[calc(100dvh-112px)]">
        {workspaceTab === "dashboard" ? (
          <>
            <section className="min-w-0 flex-1 p-3">
              <PanelErrorBoundary title="Chart Panel">
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
                <div className="flex h-[calc(100%-52px)] flex-col gap-2">
                  <div style={{ height: `${chartHeightPct}%` }}>
                    <MainChart
                      ticker={selectedTicker}
                      timeframe={timeframe}
                      chartType={chartType}
                      compareTicker={compareTicker}
                      activeIndicators={activeIndicators}
                    />
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min={35}
                      max={75}
                      value={chartHeightPct}
                      onChange={(event) => setChartHeightPct(Number(event.target.value))}
                      className="w-full"
                      aria-label="Resize chart and screener split"
                    />
                  </div>
                  <div style={{ height: `${100 - chartHeightPct}%` }}>
                    <PanelErrorBoundary title="Screener Panel">
                      <WatchlistScreenerPanel />
                    </PanelErrorBoundary>
                  </div>
                </div>
              </PanelErrorBoundary>
            </section>
            {!isMobile && <RightPanel collapsed={isRightCollapsed} ticker={selectedTicker} timeframe={timeframe} />}
          </>
        ) : workspaceTab === "news-analysis" ? (
          <div className="min-w-0 flex-1">
            <NewsAnalysisView ticker={selectedTicker} timeframe={timeframe} />
          </div>
        ) : workspaceTab === "carla-setup" ? (
          <div className="min-w-0 flex-1">
            <CarlaSetupView />
          </div>
        ) : workspaceTab === "market-sentiment" ? (
          <div className="min-w-0 flex-1">
            <MarketSentimentView />
          </div>
        ) : workspaceTab === "live-monitor" ? (
          <div className="min-w-0 flex-1">
            <LiveMonitorView ticker={selectedTicker} compareTicker={compareTicker} />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <CompareView
              primaryTicker={selectedTicker}
              compareTicker={compareTicker}
              timeframe={timeframe}
              onCompareChange={setCompareTicker}
            />
          </div>
        )}
      </main>

      {isMobile && workspaceTab === "dashboard" && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-base px-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              className={`rounded border px-2 py-1 ${mobileTab === "left" ? "border-neutral text-neutral" : "border-border text-text-muted"}`}
              onClick={() => setMobileTab("left")}
            >
              Lists + Scan
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
              </div>
            )}
            {mobileTab === "right" && <RightPanel collapsed={false} ticker={selectedTicker} timeframe={timeframe} />}
          </div>
        </nav>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toast toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

export default App;
