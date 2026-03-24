import type { ScreenerOperator, TechnicalCondition, TechnicalIndicatorName } from "../../types";

const indicators: TechnicalIndicatorName[] = [
  "RSI",
  "MACD Signal",
  "EMA(20)",
  "EMA(50)",
  "SMA(200)",
  "Price vs VWAP",
  "ATR",
  "Volume vs Avg Volume",
  "Bollinger %B",
  "Distance from 52W High/Low"
];

const operators: ScreenerOperator[] = [">", "<", "=", "crosses above", "crosses below", "between"];

interface ConditionRowProps {
  condition: TechnicalCondition;
  onChange: (condition: TechnicalCondition) => void;
  onRemove: () => void;
}

export function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  const value = Array.isArray(condition.value) ? condition.value.join(",") : String(condition.value);
  return (
    <div className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 rounded border border-border bg-surface p-2">
      <select
        className="rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
        value={condition.indicator}
        onChange={(event) => onChange({ ...condition, indicator: event.target.value as TechnicalIndicatorName })}
      >
        {indicators.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
        value={condition.operator}
        onChange={(event) => onChange({ ...condition, operator: event.target.value as ScreenerOperator })}
      >
        {operators.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <input
        className="rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
        value={value}
        onChange={(event) => {
          const raw = event.target.value.trim();
          const parsed = raw.includes(",")
            ? (raw.split(",").map((part) => Number(part.trim())) as [number, number])
            : Number(raw || 0);
          onChange({ ...condition, value: parsed });
        }}
      />
      <button
        className="rounded border border-bearish/40 px-2 py-1 text-xs text-bearish hover:bg-bearish/10"
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
