/**
 * Monitor Agent Component
 *
 * Displays real-time alerts from the autonomous monitoring agent:
 * - Technical patterns (golden cross, death cross, breakout, etc.)
 * - Volume spikes
 * - Sentiment shifts
 * - Price level breaches
 */

import { useEffect, useState } from "react";
import { monitorWatchlist, getAgentStatus } from "../../services/agentService";
import type { MonitorAlert, AlertType } from "../../types";

interface MonitorAgentProps {
  watchlist?: string[];
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

const alertTypeIcons: Record<AlertType, string> = {
  GOLDEN_CROSS: "📈",
  DEATH_CROSS: "📉",
  BREAKOUT: "🚀",
  BREAKDOWN: "🔻",
  VOLUME_SPIKE: "📊",
  SENTIMENT_SURGE: "💬",
  PRICE_TARGET_BREACH: "🎯",
  RSI_EXTREME: "📐",
  MA_BOUNCE: "〰️",
  SUPPORT_TEST: "🧱",
  RESISTANCE_REJECT: "🚫",
};

const severityColors: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", string> = {
  LOW: "border-text-muted bg-text-muted/10",
  MEDIUM: "border-warning bg-warning/10",
  HIGH: "border-bearish bg-bearish/10",
  CRITICAL: "border-red-600 bg-red-600/10",
};

export function MonitorAgent({
  watchlist = [],
  autoRefresh = true,
  refreshIntervalMs = 60000,
}: MonitorAgentProps) {
  const [alerts, setAlerts] = useState<MonitorAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchAlerts = async () => {
    if (watchlist.length === 0) return;

    setLoading(true);
    const status = await getAgentStatus();

    if (!status?.enabled) {
      setAgentEnabled(false);
      setLoading(false);
      return;
    }

    setAgentEnabled(true);
    const results = await monitorWatchlist(watchlist);
    setAlerts(results);
    setLastChecked(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();

    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [watchlist.join(","), autoRefresh, refreshIntervalMs]);

  if (agentEnabled === false) {
    return (
      <div className="card flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-2xl">🔔</div>
        <h3 className="text-lg font-semibold text-text-primary">Smart Monitor</h3>
        <p className="mt-2 text-sm text-text-muted">
          Configure AI API keys to enable automatic monitoring
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Auto-detect technical patterns, volume spikes, sentiment changes
        </p>
      </div>
    );
  }

  if (watchlist.length === 0) {
    return (
      <div className="card flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-2xl">📋</div>
        <h3 className="text-lg font-semibold text-text-primary">Watchlist Monitor</h3>
        <p className="mt-2 text-sm text-text-muted">
          Add stocks to your watchlist to start monitoring
        </p>
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <h3 className="text-sm font-semibold text-text-primary">Smart Monitor Alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral border-t-transparent" />
          )}
          <button
            onClick={fetchAlerts}
            className="text-xs text-neutral hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-text-muted">
            <div>
              <div className="mb-2 text-2xl">✅</div>
              <p className="text-sm">No alerts</p>
              <p className="text-xs">
                Monitoring {watchlist.length} stocks
                {lastChecked && ` · ${lastChecked.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
        Monitoring {watchlist.length} stocks · {lastChecked?.toLocaleTimeString() || "Not checked yet"}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: MonitorAlert }) {
  return (
    <div className={`rounded border p-3 ${severityColors[alert.severity]}`}>
      <div className="mb-1 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{alertTypeIcons[alert.type]}</span>
          <span className="font-medium text-text-primary">{alert.title}</span>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>

      <div className="mb-2 text-sm text-text-muted">{alert.description}</div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted">
          {alert.symbol} · {new Date(alert.timestamp).toLocaleTimeString()}
        </div>
        {alert.suggestedAction && (
          <div className="text-xs text-neutral" title={alert.suggestedAction}>
            💡 {alert.suggestedAction}
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: MonitorAlert["severity"] }) {
  const colors: Record<string, string> = {
    LOW: "bg-text-muted text-white",
    MEDIUM: "bg-warning text-white",
    HIGH: "bg-bearish text-white",
    CRITICAL: "bg-red-600 text-white",
  };

  const labels: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  };

  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[severity]}`}>
      {labels[severity]}
    </span>
  );
}
