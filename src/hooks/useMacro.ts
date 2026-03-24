import { useQuery } from "@tanstack/react-query";

export interface MacroIndicatorPoint {
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

export interface MacroResponse {
  indicators: MacroIndicatorPoint[];
  updatedAt: string;
  source: "FRED";
}

export const useMacro = () =>
  useQuery({
    queryKey: ["macro", "fred"],
    queryFn: async () => {
      const response = await fetch("/api/macro/fred");
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to load macro indicators");
      }
      return (await response.json()) as MacroResponse;
    },
    refetchInterval: 10 * 60_000,
    retry: 1
  });

