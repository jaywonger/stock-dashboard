import { Router } from "express";

interface MacroRouteConfig {
  fredApiKey?: string;
}

interface FredObservation {
  date: string;
  value: string;
}

interface MacroIndicator {
  key: string;
  label: string;
  seriesId: string;
  unit: string;
  frequency: "daily" | "monthly" | "quarterly";
}

interface MacroPoint {
  key: string;
  label: string;
  seriesId: string;
  unit: string;
  frequency: "daily" | "monthly" | "quarterly";
  value: number | null;
  previous: number | null;
  change: number | null;
  changePct: number | null;
  asOf: string | null;
}

interface MacroResponse {
  indicators: MacroPoint[];
  updatedAt: string;
  source: "FRED";
}

const INDICATORS: MacroIndicator[] = [
  { key: "fedFunds", label: "Fed Funds Rate", seriesId: "FEDFUNDS", unit: "%", frequency: "monthly" },
  { key: "cpi", label: "CPI (YoY proxy)", seriesId: "CPIAUCSL", unit: "index", frequency: "monthly" },
  { key: "unemployment", label: "Unemployment Rate", seriesId: "UNRATE", unit: "%", frequency: "monthly" },
  { key: "tenYearYield", label: "10Y Treasury Yield", seriesId: "DGS10", unit: "%", frequency: "daily" },
  { key: "twoYearYield", label: "2Y Treasury Yield", seriesId: "DGS2", unit: "%", frequency: "daily" }
];

const toNumber = (value: string): number | null => {
  if (!value || value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const latestTwoValues = (observations: FredObservation[]): { latest: FredObservation | null; previous: FredObservation | null } => {
  const valid = observations.filter((item) => toNumber(item.value) !== null);
  return { latest: valid[0] ?? null, previous: valid[1] ?? null };
};

const fetchIndicator = async (apiKey: string, indicator: MacroIndicator): Promise<MacroPoint> => {
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(indicator.seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=12`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FRED ${indicator.seriesId} failed (${response.status})`);
  }
  const payload = (await response.json()) as { observations?: FredObservation[] };
  const { latest, previous } = latestTwoValues(payload.observations ?? []);
  const latestValue = latest ? toNumber(latest.value) : null;
  const previousValue = previous ? toNumber(previous.value) : null;
  const change = latestValue !== null && previousValue !== null ? latestValue - previousValue : null;
  const changePct =
    latestValue !== null && previousValue !== null && previousValue !== 0
      ? ((latestValue - previousValue) / Math.abs(previousValue)) * 100
      : null;

  return {
    key: indicator.key,
    label: indicator.label,
    seriesId: indicator.seriesId,
    unit: indicator.unit,
    frequency: indicator.frequency,
    value: latestValue,
    previous: previousValue,
    change,
    changePct,
    asOf: latest?.date ?? null
  };
};

export const createMacroRouter = (config: MacroRouteConfig) => {
  const router = Router();
  const cacheTtlMs = 10 * 60_000;
  let cached: { payload: MacroResponse; cachedAt: number } | null = null;
  let inflight: Promise<MacroResponse> | null = null;

  const load = async (): Promise<MacroResponse> => {
    if (!config.fredApiKey) {
      throw new Error("FRED API key not configured");
    }
    const indicators = await Promise.all(INDICATORS.map((indicator) => fetchIndicator(config.fredApiKey!, indicator)));
    return {
      indicators,
      updatedAt: new Date().toISOString(),
      source: "FRED"
    };
  };

  router.get("/fred", async (_req, res) => {
    try {
      if (!config.fredApiKey) {
        return res.status(503).json({ error: "FRED API key not configured. Set FRED_API_KEY in .env." });
      }
      const now = Date.now();
      if (cached && now - cached.cachedAt < cacheTtlMs) {
        return res.json(cached.payload);
      }

      if (!inflight) {
        inflight = load()
          .then((payload) => {
            cached = { payload, cachedAt: Date.now() };
            return payload;
          })
          .finally(() => {
            inflight = null;
          });
      }
      const payload = await inflight;
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load FRED indicators" });
    }
  });

  return router;
};

