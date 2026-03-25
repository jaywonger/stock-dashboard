import { useQuery } from "@tanstack/react-query";
import type { Watchlist } from "../types";

async function fetchWatchlists(): Promise<Watchlist[]> {
  const response = await fetch("/api/watchlists");
  if (!response.ok) throw new Error("Failed to load watchlists");
  return response.json();
}

export const useWatchlists = () =>
  useQuery({
    queryKey: ["watchlists"],
    queryFn: fetchWatchlists
  });

