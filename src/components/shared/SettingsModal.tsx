import { useMemo, useState } from "react";
import { Eye, EyeOff, X, Bot } from "lucide-react";
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
  { label: "Benzinga API Key", key: "benzingaApiKey" }
];

const aiFields: Array<{ label: string; key: string; placeholder?: string; hint?: string }> = [
  { label: "LiteLLM Model", key: "litellmModel", placeholder: "gemini/gemini-2.0-flash", hint: "Format: provider/model-name" },
  { label: "LiteLLM API Key", key: "litellmApiKey", placeholder: "sk-..." },
  { label: "LiteLLM Base URL", key: "litellmBaseUrl", hint: "Optional: Custom LiteLLM proxy server" },
  { label: "Gemini API Key", key: "geminiApiKey", hint: "Google AI Studio" },
  { label: "Claude API Key", key: "claudeApiKey", hint: "Anthropic Console" },
  { label: "OpenAI API Key", key: "openaiApiKey", hint: "platform.openai.com" },
  { label: "OpenAI Base URL", key: "openaiBaseUrl", placeholder: "https://api.openai.com/v1", hint: "For compatible APIs (DeepSeek, etc.)" },
  { label: "OpenAI Model", key: "openaiModel", placeholder: "gpt-4o-mini" },
  { label: "OpenRouter API Key", key: "openrouterApiKey", hint: "openrouter.ai" },
  { label: "OpenRouter Base URL", key: "openrouterBaseUrl", placeholder: "https://openrouter.ai/api/v1" },
  { label: "OpenRouter Model", key: "openrouterModel", placeholder: "openai/gpt-4o-mini" },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useSettingsStore();
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [agentEnabled, setAgentEnabled] = useState(false);

  // Load AI settings from localStorage
  const getAiSetting = (key: string) => localStorage.getItem(`ai_${key}`) || "";
  const setAiSetting = (key: string, value: string) => {
    localStorage.setItem(`ai_${key}`, value);
    // Also sync to store for AI keys
    if (
      key.endsWith("Key") ||
      key.endsWith("Url") ||
      key === "litellmModel" ||
      key === "openaiModel" ||
      key === "openrouterModel"
    ) {
      const storeKey = key as keyof typeof settings.keys;
      if (storeKey in settings.keys) {
        settings.setAiApiKey(storeKey, value);
      }
    }
  };

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
            {["yfinance", "polygon", "finnhub", "alphaVantage", "yahoo", "mock"].map((provider) => (
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

        {/* AI Agent Configuration */}
        <section className="mt-6 rounded-lg border border-border bg-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="text-bullish" size={20} />
            <h3 className="font-semibold text-text-primary">AI Agent</h3>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={agentEnabled}
                onChange={(e) => {
                  setAgentEnabled(e.target.checked);
                  setAiSetting("enabled", e.target.checked.toString());
                }}
              />
              Enable AI Agent features
            </label>
          </div>

          <p className="mb-3 text-xs text-text-muted">
            Configure AI models for stock analysis, chat, and autonomous monitoring.
            Uses <a href="https://github.com/BerriAI/litellm" target="_blank" className="text-neutral hover:underline">LiteLLM</a> for unified access to 100+ models.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {aiFields.map((field) => {
              const value = getAiSetting(field.key);
              const isVisible = visible[field.key];

              return (
                <div key={field.key} className="rounded border border-border bg-surface p-3">
                  <label className="mb-1 block text-xs font-medium text-text-primary">{field.label}</label>
                  {field.hint && <p className="mb-1 text-xs text-text-muted">{field.hint}</p>}
                  <div className="flex gap-2">
                    <input
                      type={isVisible ? "text" : "password"}
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(e) => setAiSetting(field.key, e.target.value)}
                      className="w-full rounded border border-border bg-base px-2 py-2 text-sm text-text-primary focus:border-neutral focus:outline-none"
                    />
                    <button
                      onClick={() => setVisible((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                      className="shrink-0 rounded border border-border px-2 text-text-muted hover:text-text-primary"
                    >
                      {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <strong>Notice:</strong> AI analysis results are for informational purposes only and do not constitute investment advice. Please make your own investment decisions.
          </div>
        </section>
      </div>
    </div>
  );
}
