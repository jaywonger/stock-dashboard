import { useQuery } from "@tanstack/react-query";
import type { ScreenerRow } from "../types";
import { useScreenerStore } from "../store/screenerStore";
import { useSettingsStore } from "../store/settingsStore";

interface ScreenerResponse {
  rows: ScreenerRow[];
}

export const useScreener = () => {
  const config = useScreenerStore((state) => state.config);
  const setResults = useScreenerStore((state) => state.setResults);
  const refreshInterval = useSettingsStore((state) => state.refreshIntervals.screener);

  return useQuery({
    queryKey: ["screener", config],
    queryFn: async () => {
      const response = await fetch("/api/screener/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (!response.ok) throw new Error("Screener request failed");
      const payload = (await response.json()) as ScreenerResponse;
      setResults(payload.rows);
      return payload.rows;
    },
    refetchInterval: refreshInterval
  });
};
