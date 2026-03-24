import type { ScreenerConfig } from "../../types";

interface PresetScreenersProps {
  onSelect: (config: ScreenerConfig) => void;
}

const presetConfigs: Array<{ name: string; config: ScreenerConfig }> = [
  {
    name: "Oversold Bounce",
    config: {
      basic: {
        exchange: "All",
        marketCapRange: { min: null, max: null },
        sectors: [],
        priceMin: null,
        priceMax: null,
        minAverageVolume30d: 500000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "p1", indicator: "RSI", operator: "<", value: 30 },
        { id: "p2", indicator: "Distance from 52W High/Low", operator: "<", value: 15 }
      ]
    }
  },
  {
    name: "Momentum Breakout",
    config: {
      basic: {
        exchange: "All",
        marketCapRange: { min: null, max: null },
        sectors: [],
        priceMin: null,
        priceMax: null,
        minAverageVolume30d: 1000000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "p3", indicator: "EMA(20)", operator: ">", value: 1 },
        { id: "p4", indicator: "Volume vs Avg Volume", operator: ">", value: 2 },
        { id: "p5", indicator: "RSI", operator: ">", value: 55 }
      ]
    }
  },
  {
    name: "Golden Cross Setup",
    config: {
      basic: {
        exchange: "All",
        marketCapRange: { min: null, max: null },
        sectors: [],
        priceMin: null,
        priceMax: null,
        minAverageVolume30d: null
      },
      technicalJoin: "AND",
      technicalConditions: [{ id: "p6", indicator: "EMA(50)", operator: "crosses above", value: 200 }]
    }
  },
  {
    name: "High Relative Volume",
    config: {
      basic: {
        exchange: "All",
        marketCapRange: { min: null, max: null },
        sectors: [],
        priceMin: null,
        priceMax: null,
        minAverageVolume30d: 1000000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "p7", indicator: "Volume vs Avg Volume", operator: ">", value: 3 },
        { id: "p8", indicator: "RSI", operator: ">", value: 50 }
      ]
    }
  },
  {
    name: "Squeeze Setup",
    config: {
      basic: {
        exchange: "All",
        marketCapRange: { min: null, max: null },
        sectors: [],
        priceMin: null,
        priceMax: null,
        minAverageVolume30d: null
      },
      technicalJoin: "AND",
      technicalConditions: [{ id: "p9", indicator: "Bollinger %B", operator: "between", value: [0.2, 0.8] }]
    }
  }
];

export function PresetScreeners({ onSelect }: PresetScreenersProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-text-muted">Preset Screeners</h3>
      <div className="grid gap-2">
        {presetConfigs.map((preset) => (
          <button
            key={preset.name}
            className="rounded border border-border bg-surface px-2 py-1.5 text-left text-xs text-text-muted transition hover:border-neutral hover:text-text-primary"
            onClick={() => onSelect(preset.config)}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
