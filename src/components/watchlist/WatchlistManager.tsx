import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Plus } from "lucide-react";
import type { Watchlist, WatchlistItem } from "../../types";
import { useQuote } from "../../hooks/useQuote";
import { useMarketStore } from "../../store/marketStore";
import { Skeleton } from "../shared/Skeleton";
import { WatchlistRow } from "./WatchlistRow";

interface WatchlistManagerProps {
  collapsed?: boolean;
  embedded?: boolean;
}

async function fetchWatchlists(): Promise<Watchlist[]> {
  const response = await fetch("/api/watchlists");
  if (!response.ok) throw new Error("Failed to load watchlists");
  return response.json();
}

function RowWithQuote({
  item,
  onSelect,
  onRemove
}: {
  item: WatchlistItem;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const quote = useQuote(item.symbol);
  return <WatchlistRow item={item} quote={quote.data} onClick={onSelect} onRemove={onRemove} />;
}

export function WatchlistManager({ collapsed = false, embedded = false }: WatchlistManagerProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const setTicker = useMarketStore((state) => state.setSelectedTicker);
  const [activeWatchlistId, setActiveWatchlistId] = useState<number | null>(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [newWatchlistName, setNewWatchlistName] = useState("");

  const watchlistsQuery = useQuery({
    queryKey: ["watchlists"],
    queryFn: fetchWatchlists
  });

  const watchlists = watchlistsQuery.data ?? [];
  const activeWatchlist =
    watchlists.find((watchlist) => watchlist.id === activeWatchlistId) ?? watchlists[0] ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["watchlists"] });

  const addWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    await fetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWatchlistName.trim() })
    });
    setNewWatchlistName("");
    refresh();
  };

  const addTicker = async () => {
    if (!activeWatchlist || !newSymbol.trim()) return;
    await fetch(`/api/watchlists/${activeWatchlist.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: newSymbol.trim().toUpperCase() })
    });
    setNewSymbol("");
    refresh();
  };

  const removeTicker = async (symbol: string) => {
    if (!activeWatchlist) return;
    await fetch(`/api/watchlists/${activeWatchlist.id}/items/${symbol}`, { method: "DELETE" });
    refresh();
  };

  const exportCsv = () => {
    if (!activeWatchlist) return;
    const rows = activeWatchlist.items.map((item) => `${item.symbol},${item.companyName}`);
    const csv = ["symbol,company", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeWatchlist.name.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeWatchlist) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const symbols = text
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",")[0]?.trim().toUpperCase())
      .filter(Boolean);
    await Promise.all(
      symbols.map((symbol) =>
        fetch(`/api/watchlists/${activeWatchlist.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol })
        })
      )
    );
    refresh();
  };

  if (collapsed) return null;

  const wrapperClass = embedded ? "flex h-full flex-col p-0" : "card flex h-full flex-col p-3";

  return (
    <div className={wrapperClass}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Watchlists</h2>
        <p className="text-xs text-text-muted">Right click ticker row to remove</p>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          className="w-full rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary"
          placeholder="New watchlist name"
          value={newWatchlistName}
          onChange={(event) => setNewWatchlistName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void addWatchlist();
          }}
        />
        <button className="rounded border border-border px-2 text-text-muted hover:text-text-primary" onClick={addWatchlist}>
          <Plus size={14} />
        </button>
      </div>

      <div className="mb-3">
        <select
          value={activeWatchlist?.id ?? ""}
          onChange={(event) => setActiveWatchlistId(Number(event.target.value))}
          className="w-full rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary"
        >
          {watchlists.map((watchlist) => (
            <option key={watchlist.id} value={watchlist.id}>
              {watchlist.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          className="w-full rounded border border-border bg-base px-2 py-1.5 text-sm text-text-primary ticker-font"
          placeholder="Add ticker"
          value={newSymbol}
          onChange={(event) => setNewSymbol(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void addTicker();
          }}
        />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary" onClick={exportCsv}>
          <Download size={12} className="mr-1 inline" /> CSV
        </button>
        <button
          className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary"
          onClick={() => fileRef.current?.click()}
        >
          <FileUp size={12} className="mr-1 inline" /> Import
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(event) => void importCsv(event)} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {watchlistsQuery.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {watchlistsQuery.isError && (
          <div className="rounded border border-bearish/30 bg-bearish/10 p-2 text-xs text-bearish">
            Failed to load watchlists.
          </div>
        )}
        {!watchlistsQuery.isLoading && activeWatchlist && activeWatchlist.items.length === 0 && (
          <div className="rounded border border-border bg-panel p-2 text-xs text-text-muted">
            No symbols yet. Add a ticker above or import CSV.
          </div>
        )}
        <div className="space-y-1">
          {activeWatchlist?.items.map((item) => (
            <RowWithQuote
              key={item.symbol}
              item={item}
              onSelect={() => setTicker(item.symbol)}
              onRemove={() => void removeTicker(item.symbol)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
