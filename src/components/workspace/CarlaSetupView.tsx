import { useEffect, useMemo, useState } from "react";
import type { BasicScreenerFilters, ScreenerConfig } from "../../types";
import { useScreener } from "../../hooks/useScreener";
import { useNewsTeamAnalysis } from "../../hooks/useNewsTeamAnalysis";
import { useMarketStore } from "../../store/marketStore";
import { useScreenerStore } from "../../store/screenerStore";
import { DailyDecisionCard } from "../news/DailyDecisionCard";
import { OpenInsiderCard } from "../news/OpenInsiderCard";
import { TeamDebateCard } from "../news/TeamDebateCard";
import { ScreenerResults } from "../screener/ScreenerResults";

type CarlaPresetId = "best-buy" | "higher-growth" | "commodities";
type FilterMode = "strict" | "auto" | "relaxed";

interface CarlaPreset {
  id: CarlaPresetId;
  label: string;
  strictChips: string[];
  relaxedChips: string[];
  strictConfig: ScreenerConfig;
  relaxedConfig: ScreenerConfig;
}

const presets: CarlaPreset[] = [
  {
    id: "best-buy",
    label: "Best Buy Opportunity",
    strictChips: [
      "Market cap > 1B",
      "P/E 5 to 14",
      "Dividend yield 3% to 7%",
      "ROE > 15%",
      "Revenue growth YoY > 0%",
      "EPS growth YoY > 0%",
      "Operating margin > 8%",
      "Avg Volume 10D > 1M"
    ],
    relaxedChips: [
      "Market cap > 750M",
      "Value + quality tilt",
      "RSI 35 to 72",
      "MACD signal > -0.1",
      "Rel Volume > 0.9"
    ],
    strictConfig: {
      basic: {
        exchange: "All",
        marketCapRange: { min: 1_000_000_000, max: null },
        sectors: [],
        priceMin: 5,
        priceMax: null,
        minAverageVolume30d: 1_000_000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "carla-bb-1", indicator: "RSI", operator: "between", value: [40, 68] },
        { id: "carla-bb-2", indicator: "MACD Signal", operator: ">", value: 0 },
        { id: "carla-bb-3", indicator: "Volume vs Avg Volume", operator: ">", value: 1.05 }
      ]
    }
    ,
    relaxedConfig: {
      basic: {
        exchange: "All",
        marketCapRange: { min: 750_000_000, max: null },
        sectors: [],
        priceMin: 3,
        priceMax: null,
        minAverageVolume30d: 500_000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "carla-bbr-1", indicator: "RSI", operator: "between", value: [35, 72] },
        { id: "carla-bbr-2", indicator: "MACD Signal", operator: ">", value: -0.1 },
        { id: "carla-bbr-3", indicator: "Volume vs Avg Volume", operator: ">", value: 0.9 }
      ]
    }
  },
  {
    id: "higher-growth",
    label: "Higher Growth",
    strictChips: [
      "Market cap > 10B",
      "P/E 20 to 80",
      "Revenue growth YoY > 15%",
      "ROE > 15%",
      "EPS growth YoY > 20%",
      "Operating margin > 15%",
      "6M Perf > 10%"
    ],
    relaxedChips: [
      "Market cap > 5B",
      "Growth + momentum tilt",
      "RSI > 50",
      "MACD signal > -0.1",
      "Rel Volume > 1.0"
    ],
    strictConfig: {
      basic: {
        exchange: "All",
        marketCapRange: { min: 10_000_000_000, max: null },
        sectors: [],
        priceMin: 10,
        priceMax: null,
        minAverageVolume30d: 800_000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "carla-hg-1", indicator: "RSI", operator: ">", value: 55 },
        { id: "carla-hg-2", indicator: "MACD Signal", operator: ">", value: 0 },
        { id: "carla-hg-3", indicator: "Volume vs Avg Volume", operator: ">", value: 1.15 },
        { id: "carla-hg-4", indicator: "Distance from 52W High/Low", operator: ">", value: 55 }
      ]
    }
    ,
    relaxedConfig: {
      basic: {
        exchange: "All",
        marketCapRange: { min: 5_000_000_000, max: null },
        sectors: [],
        priceMin: 8,
        priceMax: null,
        minAverageVolume30d: 500_000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "carla-hgr-1", indicator: "RSI", operator: ">", value: 50 },
        { id: "carla-hgr-2", indicator: "MACD Signal", operator: ">", value: -0.1 },
        { id: "carla-hgr-3", indicator: "Volume vs Avg Volume", operator: ">", value: 1.0 },
        { id: "carla-hgr-4", indicator: "Distance from 52W High/Low", operator: ">", value: 45 }
      ]
    }
  },
  {
    id: "commodities",
    label: "Commodities",
    strictChips: [
      "Market cap > 2B",
      "P/E 5 to 25",
      "EPS growth YoY > 20%",
      "Revenue growth YoY > 10%",
      "Operating margin > 10%",
      "6M Perf > 15%",
      "3M Perf > 5%"
    ],
    relaxedChips: [
      "Market cap > 1B",
      "Commodity momentum tilt",
      "RSI > 48",
      "MACD signal > -0.2",
      "Rel Volume > 0.95"
    ],
    strictConfig: {
      basic: {
        exchange: "All",
        marketCapRange: { min: 2_000_000_000, max: null },
        sectors: [],
        priceMin: 5,
        priceMax: null,
        minAverageVolume30d: 500_000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "carla-cm-1", indicator: "RSI", operator: ">", value: 50 },
        { id: "carla-cm-2", indicator: "MACD Signal", operator: ">", value: 0 },
        { id: "carla-cm-3", indicator: "Volume vs Avg Volume", operator: ">", value: 1.1 },
        { id: "carla-cm-4", indicator: "Distance from 52W High/Low", operator: ">", value: 60 }
      ]
    }
    ,
    relaxedConfig: {
      basic: {
        exchange: "All",
        marketCapRange: { min: 1_000_000_000, max: null },
        sectors: [],
        priceMin: 3,
        priceMax: null,
        minAverageVolume30d: 350_000
      },
      technicalJoin: "AND",
      technicalConditions: [
        { id: "carla-cmr-1", indicator: "RSI", operator: ">", value: 48 },
        { id: "carla-cmr-2", indicator: "MACD Signal", operator: ">", value: -0.2 },
        { id: "carla-cmr-3", indicator: "Volume vs Avg Volume", operator: ">", value: 0.95 },
        { id: "carla-cmr-4", indicator: "Distance from 52W High/Low", operator: ">", value: 50 }
      ]
    }
  }
];

export function CarlaSetupView() {
  const selectedTicker = useMarketStore((state) => state.selectedTicker);
  const [active, setActive] = useState<CarlaPresetId>("best-buy");
  const [exchange, setExchange] = useState<BasicScreenerFilters["exchange"]>("NYSE");
  const [mode, setMode] = useState<FilterMode>("auto");
  const [autoRelaxed, setAutoRelaxed] = useState(false);
  const [analysisTickerInput, setAnalysisTickerInput] = useState(selectedTicker);
  const [analysisTicker, setAnalysisTicker] = useState(selectedTicker);
  const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().slice(0, 10));
  const [debateRounds, setDebateRounds] = useState(3);
  const setConfig = useScreenerStore((state) => state.setConfig);
  const preset = useMemo(() => presets.find((item) => item.id === active) ?? presets[0], [active]);
  const screenerQuery = useScreener();
  const teamQuery = useNewsTeamAnalysis(analysisTicker, "1D", analysisDate, debateRounds);
  const rows = screenerQuery.data ?? [];
  const effectiveRelaxed = mode === "relaxed" || (mode === "auto" && autoRelaxed);

  useEffect(() => {
    setAutoRelaxed(false);
  }, [active, exchange, mode]);

  useEffect(() => {
    if (mode !== "auto" || autoRelaxed || screenerQuery.isLoading || screenerQuery.isError) return;
    if (rows.length === 0) {
      setAutoRelaxed(true);
    }
  }, [mode, autoRelaxed, rows.length, screenerQuery.isError, screenerQuery.isLoading]);

  useEffect(() => {
    const base = effectiveRelaxed ? preset.relaxedConfig : preset.strictConfig;
    setConfig({
      ...base,
      basic: {
        ...base.basic,
        exchange
      }
    });
  }, [effectiveRelaxed, exchange, preset, setConfig]);

  return (
    <section className="h-full overflow-y-auto p-3">
      <div className="card monitor-grid mb-3 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <span className="intel-chip">Carla&apos;s Setup</span>
          {presets.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`rounded border px-2 py-1 text-xs ${
                active === item.id
                  ? "border-neutral/70 bg-neutral/12 text-text-primary"
                  : "border-border bg-surface text-text-muted hover:text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
          <select
            value={exchange}
            onChange={(event) => setExchange(event.target.value as BasicScreenerFilters["exchange"])}
            className="ml-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
          >
            <option value="NYSE">NYSE</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="TSX">TSX</option>
            <option value="B3">B3 (Brasil)</option>
            <option value="AMEX">AMEX</option>
            <option value="LSE">LSE</option>
            <option value="OTC">OTC</option>
            <option value="All">All</option>
          </select>
          <div className="ml-1 inline-flex rounded border border-border bg-surface p-0.5 text-xs">
            {(["strict", "auto", "relaxed"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`rounded px-2 py-1 ${
                  mode === item ? "bg-neutral/20 text-text-primary" : "text-text-muted hover:text-text-primary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {mode === "auto" && autoRelaxed && (
          <p className="mb-2 text-xs text-warning">
            Strict filters returned 0 symbols. Auto mode switched to relaxed filters for broader matches.
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {(effectiveRelaxed ? preset.relaxedChips : preset.strictChips).map((chip) => (
            <span key={chip} className="rounded border border-border bg-[#121826] px-2 py-1 text-[11px] text-text-muted">
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="grid h-[calc(100%-112px)] min-h-[360px] gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card min-h-0 overflow-hidden border border-border bg-panel">
          <ScreenerResults
            onSelectTicker={(ticker) => {
              setAnalysisTicker(ticker);
              setAnalysisTickerInput(ticker);
            }}
          />
        </div>
        <div className="card min-h-0 overflow-y-auto border border-border bg-panel p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="intel-title">Stock Analysis</h3>
            <span className="intel-chip ticker-font">{analysisTicker}</span>
            <span className="intel-chip">Timeframe 1D</span>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-[120px_1fr]">
            <input
              value={analysisTickerInput}
              onChange={(event) => setAnalysisTickerInput(event.target.value.toUpperCase())}
              className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary ticker-font"
              placeholder="Ticker"
            />
            <button
              onClick={() => setAnalysisTicker(analysisTickerInput.trim().toUpperCase() || selectedTicker)}
              className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-text-primary hover:border-neutral"
            >
              Analyze Ticker
            </button>
            <input
              type="date"
              value={analysisDate}
              onChange={(event) => setAnalysisDate(event.target.value)}
              className="rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary"
            />
            <label className="rounded border border-border bg-base px-2 py-1 text-xs text-text-muted">
              Debate rounds: {debateRounds}
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={debateRounds}
                onChange={(event) => setDebateRounds(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </div>

          <DailyDecisionCard ticker={analysisTicker} timeframe="1D" />
          <OpenInsiderCard ticker={analysisTicker} />
          <TeamDebateCard isLoading={teamQuery.isLoading} isError={teamQuery.isError} data={teamQuery.data} />
        </div>
      </div>
    </section>
  );
}
