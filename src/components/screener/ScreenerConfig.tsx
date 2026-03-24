import { useState } from "react";
import { Plus } from "lucide-react";
import type { TechnicalCondition } from "../../types";
import { useScreenerStore } from "../../store/screenerStore";
import { ConditionRow } from "./ConditionRow";
import { PresetScreeners } from "./PresetScreeners";

interface ScreenerConfigProps {
  collapsed?: boolean;
  embedded?: boolean;
}

export function ScreenerConfig({ collapsed = false, embedded = false }: ScreenerConfigProps) {
  const { config, setConfig } = useScreenerStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (collapsed) return null;

  const appendCondition = () => {
    const newCondition: TechnicalCondition = {
      id: crypto.randomUUID(),
      indicator: "RSI",
      operator: "<",
      value: 30
    };
    setConfig({
      ...config,
      technicalConditions: [...config.technicalConditions, newCondition]
    });
  };

  return (
    <div className={`${embedded ? "flex h-full flex-col p-0" : "card mt-3 flex h-[45%] flex-col p-3"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Screener</h2>
        <button
          className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? "Hide Advanced" : "Advanced"}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-text-muted">
          Exchange
          <select
            className="mt-1 w-full rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
            value={config.basic.exchange}
            onChange={(event) =>
              setConfig({
                ...config,
                basic: { ...config.basic, exchange: event.target.value as typeof config.basic.exchange }
              })
            }
          >
            <option value="All">All</option>
            <option value="NYSE">NYSE</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="AMEX">AMEX</option>
            <option value="TSX">TSX</option>
            <option value="B3">B3 (Brasil)</option>
            <option value="LSE">LSE</option>
            <option value="OTC">OTC</option>
          </select>
        </label>
        <label className="text-xs text-text-muted">
          Min Avg Vol 30d
          <input
            type="number"
            className="mt-1 w-full rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
            value={config.basic.minAverageVolume30d ?? ""}
            onChange={(event) =>
              setConfig({
                ...config,
                basic: { ...config.basic, minAverageVolume30d: Number(event.target.value || 0) || null }
              })
            }
          />
        </label>
      </div>

      <PresetScreeners onSelect={(preset) => setConfig(preset)} />

      {showAdvanced && (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wide text-text-muted">Technical Conditions</h3>
            <button
              className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary"
              onClick={appendCondition}
            >
              <Plus size={12} className="mr-1 inline" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {config.technicalConditions.length === 0 && (
              <div className="rounded border border-border bg-panel p-2 text-xs text-text-muted">
                No conditions set. Add one to filter screener output.
              </div>
            )}
            {config.technicalConditions.map((condition) => (
              <ConditionRow
                key={condition.id}
                condition={condition}
                onChange={(next) =>
                  setConfig({
                    ...config,
                    technicalConditions: config.technicalConditions.map((item) => (item.id === next.id ? next : item))
                  })
                }
                onRemove={() =>
                  setConfig({
                    ...config,
                    technicalConditions: config.technicalConditions.filter((item) => item.id !== condition.id)
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
