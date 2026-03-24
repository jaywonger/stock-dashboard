import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronLeftSquare, ChevronRightSquare, Globe2, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useQuote } from "../../hooks/useQuote";
import { formatPrice } from "../../lib/formatters";
import { HttpStockDataService } from "../../services/stockDataService";
import { useMarketStore } from "../../store/marketStore";
import { PriceChange } from "../shared/PriceChange";

const INDICES = ["SPY", "QQQ", "DIA", "IWM", "VIX"];
const stockService = new HttpStockDataService("/api");

interface HeaderProps {
  onOpenSettings: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

function GlobalTickerTile({ symbol }: { symbol: string }) {
  const setTicker = useMarketStore((state) => state.setSelectedTicker);
  const query = useQuote(symbol);
  if (query.isLoading || !query.data) {
    return <div className="h-12 w-[132px] animate-pulse rounded-md bg-[#1b2230]" />;
  }
  return (
    <button
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-left transition hover:border-neutral"
      onClick={() => setTicker(symbol)}
    >
      <div className="ticker-font text-xs text-text-muted">{symbol}</div>
      <div className="ticker-font text-sm font-medium text-text-primary">{formatPrice(query.data.price)}</div>
      <PriceChange change={query.data.change} changePercent={query.data.changePercent} compact />
    </button>
  );
}

export function Header({ onOpenSettings, onToggleLeft, onToggleRight }: HeaderProps) {
  const [clock, setClock] = useState(() => new Date());
  const alerts = useMarketStore((state) => state.alerts);

  const marketStatus = useQuery({
    queryKey: ["market-status"],
    queryFn: () => stockService.getMarketStatus(),
    refetchInterval: 60_000
  });

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const triggeredAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "triggered").length,
    [alerts]
  );

  const session = marketStatus.data?.session ?? "CLOSED";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[#070c14]/90 px-3 py-2 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="rounded border border-border p-1.5 text-text-muted hover:text-text-primary" onClick={onToggleLeft}>
            <ChevronLeftSquare size={16} />
          </button>
          <div className="rounded-md border border-border bg-[#0f1522] px-3 py-2 text-text-primary">
            <div className="flex items-center gap-2">
              <Globe2 size={15} className="text-neutral" />
              <div>
                <div className="text-sm font-semibold tracking-wide">World Monitor</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">Real-Time Intelligence</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {INDICES.map((symbol) => (
            <GlobalTickerTile key={symbol} symbol={symbol} />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-md border border-border bg-[#0f1522] px-3 py-1.5 text-right">
            <div className="ticker-font text-xs text-text-muted">{clock.toLocaleTimeString()}</div>
            <div className="text-xs font-medium text-text-primary">
              Session: <span className={`ticker-font ${session === "OPEN" ? "text-bullish" : "text-text-primary"}`}>{session}</span>
            </div>
          </div>
          <button className="relative rounded border border-border p-2 text-text-muted hover:text-text-primary">
            <Bell size={16} />
            {triggeredAlerts > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-bearish px-1 text-[10px] text-white">
                {triggeredAlerts}
              </span>
            )}
          </button>
          <button className="rounded border border-border p-2 text-text-muted hover:text-text-primary" onClick={onToggleRight}>
            <ChevronRightSquare size={16} />
          </button>
          <button className="rounded border border-border p-2 text-text-muted hover:text-text-primary" onClick={onOpenSettings}>
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
