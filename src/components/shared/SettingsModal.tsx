import { useMemo, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const sourceFields: Array<{ label: string; key: keyof ReturnType<typeof useSettingsStore.getState>["keys"] }> = [
  { label: "Polygon API Key", key: "polygonApiKey" },
  { label: "Alpha Vantage API Key", key: "alphaVantageApiKey" },
  { label: "Finnhub API Key", key: "finnhubApiKey" },
  { label: "NewsAPI Key", key: "newsApiKey" },
  { label: "Benzinga API Key", key: "benzingaApiKey" },
  { label: "FRED API Key", key: "fredApiKey" }
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useSettingsStore();
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

  const providerOrder = useMemo(
    () =>
      settings.providerPriority
        .filter((provider) => provider.enabled)
        .map((provider) => provider.id)
        .join(", "),
    [settings.providerPriority]
  );

  if (!open) return null;

  const runConnectionTest = async (source: string) => {
    const keyValue = String((settings.keys as Record<string, unknown>)[source] ?? "");
    if (!keyValue) {
      setTestStatus((prev) => ({ ...prev, [source]: "Missing key" }));
      return;
    }
    setTestStatus((prev) => ({ ...prev, [source]: "Testing..." }));
    try {
      const response = await fetch(
        `/api/settings/test?source=${encodeURIComponent(source)}&key=${encodeURIComponent(keyValue)}`
      );
      setTestStatus((prev) => ({
        ...prev,
        [source]: response.ok ? "Connected" : "Failed"
      }));
    } catch {
      setTestStatus((prev) => ({ ...prev, [source]: "Failed" }));
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-4">
      <div className="card max-h-[90dvh] w-full max-w-4xl overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Settings</h2>
            <p className="mt-1 text-sm text-text-muted">
              API keys are stored in localStorage for this browser and only sent to selected providers.
            </p>
          </div>
          <button className="rounded border border-border p-2 text-text-muted hover:text-text-primary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <section className="mb-6 rounded-lg border border-border bg-panel p-4">
          <h3 className="mb-3 font-semibold text-text-primary">API Keys</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {sourceFields.map((field) => (
              <div key={field.key} className="rounded border border-border bg-surface p-3">
                <label className="mb-2 block text-xs uppercase tracking-wide text-text-muted">{field.label}</label>
                <div className="flex gap-2">
                  <input
                    type={visible[field.key] ? "text" : "password"}
                    value={(settings.keys[field.key] as string) ?? ""}
                    onChange={(event) => settings.setApiKey(field.key, event.target.value)}
                    className="w-full rounded border border-border bg-base px-2 py-2 text-sm text-text-primary focus:border-neutral focus:outline-none"
                  />
                  <button
                    onClick={() => setVisible((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="rounded border border-border px-2 text-text-muted hover:text-text-primary"
                  >
                    {visible[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={() => runConnectionTest(field.key)}
                    className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary"
                  >
                    Test connection
                  </button>
                  <span className="text-xs text-text-subtle">{testStatus[field.key] ?? ""}</span>
                </div>
              </div>
            ))}
            <div className="rounded border border-border bg-surface p-3 md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-wide text-text-muted">RSS Feed URLs</label>
              <textarea
                rows={2}
                value={(settings.keys.rssFeedUrls ?? []).join(", ")}
                onChange={(event) => settings.setApiKey("rssFeedUrls", event.target.value)}
                className="w-full rounded border border-border bg-base px-2 py-2 text-sm text-text-primary focus:border-neutral focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-border bg-panel p-4">
          <h3 className="mb-2 font-semibold text-text-primary">Data Sources</h3>
          <p className="mb-3 text-sm text-text-muted">Provider fallback order: {providerOrder}</p>
          <div className="flex flex-wrap gap-2">
            {["polygon", "finnhub", "alphaVantage", "yahoo", "mock"].map((provider) => (
              <button
                key={provider}
                className="rounded border border-border px-3 py-1.5 text-sm text-text-muted hover:border-neutral hover:text-text-primary"
              >
                {provider}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-border bg-panel p-4">
          <h3 className="mb-3 font-semibold text-text-primary">Refresh Intervals</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {(["marketData", "news", "screener"] as const).map((key) => (
              <label key={key} className="rounded border border-border bg-surface p-3 text-sm text-text-muted">
                <span className="mb-2 block capitalize text-text-primary">{key}</span>
                <select
                  className="w-full rounded border border-border bg-base px-2 py-2 text-text-primary"
                  value={settings.refreshIntervals[key]}
                  onChange={(event) => settings.setRefreshInterval(key, Number(event.target.value))}
                >
                  <option value={30_000}>30s</option>
                  <option value={60_000}>1m</option>
                  <option value={300_000}>5m</option>
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-panel p-4">
          <h3 className="mb-3 font-semibold text-text-primary">Notifications</h3>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={settings.notificationEnabled}
              onChange={(event) => settings.setNotificationEnabled(event.target.checked)}
            />
            Enable browser notifications for price alerts
          </label>
        </section>
      </div>
    </div>
  );
}
