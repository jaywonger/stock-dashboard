import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Plus, Trash2 } from "lucide-react";
import type { WatchlistItem, WatchlistMetrics } from "../../types";
import { useQuote } from "../../hooks/useQuote";
import { useWatchlists } from "../../hooks/useWatchlists";
import { useWatchlistMetrics } from "../../hooks/useWatchlistMetrics";
import { useMarketStore } from "../../store/marketStore";
import { Skeleton } from "../shared/Skeleton";
import { WatchlistRow } from "./WatchlistRow";

interface WatchlistManagerProps {
  collapsed?: boolean;
  embedded?: boolean;
}

function RowWithQuote({
  item,
  onSelect,
  onRemove,
  metricsBySymbol,
  metricsLoading
}: {
  item: WatchlistItem;
  onSelect: () => void;
  onRemove: () => void;
  metricsBySymbol: Record<string, WatchlistMetrics>;
  metricsLoading: boolean;
}) {
  const quote = useQuote(item.symbol);
  return (
    <WatchlistRow
      item={item}
      quote={quote.data}
      quoteLoading={quote.isLoading}
      metrics={metricsBySymbol[item.symbol]}
      metricsLoading={metricsLoading}
      onClick={onSelect}
      onRemove={onRemove}
    />
  );
}

export function WatchlistManager({ collapsed = false, embedded = false }: WatchlistManagerProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const setTicker = useMarketStore((state) => state.setSelectedTicker);
  const activeWatchlistId = useMarketStore((state) => state.activeWatchlistId);
  const setActiveWatchlistId = useMarketStore((state) => state.setActiveWatchlistId);
  const setWatchlistName = useMarketStore((state) => state.setWatchlistName);
  const [newSymbol, setNewSymbol] = useState("");
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error">("ok");

  const watchlistsQuery = useWatchlists();

  const watchlists = watchlistsQuery.data ?? [];
  const activeWatchlist =
    watchlists.find((watchlist) => watchlist.id === activeWatchlistId) ?? watchlists[0] ?? null;
  const symbols = activeWatchlist?.items.map((item) => item.symbol) ?? [];
  const metricsQuery = useWatchlistMetrics(symbols);
  const metricsBySymbol = Object.fromEntries((metricsQuery.data ?? []).map((row) => [row.symbol, row]));

  useEffect(() => {
    if (!activeWatchlist && watchlists.length > 0) {
      setActiveWatchlistId(watchlists[0].id);
      setWatchlistName(watchlists[0].name);
      return;
    }
    if (activeWatchlist) {
      setWatchlistName(activeWatchlist.name);
    }
  }, [activeWatchlist, setActiveWatchlistId, setWatchlistName, watchlists]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["watchlists"] });

  const addWatchlist = async () => {
    const name = newWatchlistName.trim();
    if (!name) return;
    setStatusMessage(null);
    try {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "Create watchlist failed" }))) as { error?: string };
        setStatusTone("error");
        setStatusMessage(payload.error ?? "Create watchlist failed");
        return;
      }
      const payload = (await response.json()) as { id: number };
      setNewWatchlistName("");
      setActiveWatchlistId(payload.id);
      const refreshed = await watchlistsQuery.refetch();
      const created = (refreshed.data ?? []).find((item) => item.id === payload.id);
      if (created) setWatchlistName(created.name);
      setStatusTone("ok");
      setStatusMessage(`Created watchlist "${name}"`);
    } catch {
      setStatusTone("error");
      setStatusMessage("Create watchlist failed");
    }
  };

  const deleteWatchlist = async () => {
    if (!activeWatchlist) return;
    const ok = window.confirm(`Delete watchlist "${activeWatchlist.name}"?`);
    if (!ok) return;
    const response = await fetch(`/api/watchlists/${activeWatchlist.id}`, { method: "DELETE" });
    if (!response.ok) return;
    await refresh();
    const next = (watchlistsQuery.data ?? []).find((item) => item.id !== activeWatchlist.id) ?? null;
    setActiveWatchlistId(next?.id ?? null);
    setWatchlistName(next?.name ?? "Default");
  };

  const addTicker = async () => {
    if (!activeWatchlist || !newSymbol.trim()) return;
    const symbol = newSymbol.trim().toUpperCase();
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/watchlists/${activeWatchlist.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "Add ticker failed" }))) as { error?: string };
        setStatusTone("error");
        setStatusMessage(payload.error ?? "Add ticker failed");
        return;
      }
      setNewSymbol("");
      setStatusTone("ok");
      setStatusMessage(`Added ${symbol} to ${activeWatchlist.name}`);
      await watchlistsQuery.refetch();
    } catch {
      setStatusTone("error");
      setStatusMessage("Add ticker failed");
    }
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
      {statusMessage && (
        <div
          className={`mb-3 rounded border p-2 text-xs ${
            statusTone === "ok"
              ? "border-bullish/30 bg-bullish/10 text-bullish"
              : "border-bearish/30 bg-bearish/10 text-bearish"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <div className="mb-3">
        <select
          value={activeWatchlist?.id ?? ""}
          onChange={(event) => {
            const id = Number(event.target.value);
            const next = watchlists.find((watchlist) => watchlist.id === id) ?? null;
            setActiveWatchlistId(id);
            setWatchlistName(next?.name ?? "Default");
          }}
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
        <button
          className="ml-auto rounded border border-bearish/40 px-2 py-1 text-xs text-bearish hover:bg-bearish/10"
          onClick={() => void deleteWatchlist()}
          disabled={(watchlists.length || 0) <= 1}
          title={(watchlists.length || 0) <= 1 ? "At least one watchlist is required" : "Delete active watchlist"}
        >
          <Trash2 size={12} className="mr-1 inline" /> Delete
        </button>
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
        <div className="overflow-auto rounded border border-border bg-base">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead className="sticky top-0 bg-panel">
              <tr>
                <th className="border-b border-border px-2 py-2 text-left text-text-muted">Ticker</th>
                <th className="border-b border-border px-2 py-2 text-left text-text-muted">Company</th>
                <th className="border-b border-border px-2 py-2 text-right text-text-muted">Price</th>
                <th className="border-b border-border px-2 py-2 text-right text-text-muted">Change%</th>
                <th className="border-b border-border px-2 py-2 text-right text-text-muted">Volume</th>
                <th className="border-b border-border px-2 py-2 text-right text-text-muted">Rel.Vol</th>
                <th className="border-b border-border px-2 py-2 text-right text-text-muted">RSI</th>
                <th className="border-b border-border px-2 py-2 text-right text-text-muted">MACD</th>
                <th className="border-b border-border px-2 py-2 text-left text-text-muted">Sector</th>
              </tr>
            </thead>
            <tbody>
              {activeWatchlist?.items.map((item) => (
                <RowWithQuote
                  key={item.symbol}
                  item={item}
                  onSelect={() => setTicker(item.symbol)}
                  onRemove={() => void removeTicker(item.symbol)}
                  metricsBySymbol={metricsBySymbol}
                  metricsLoading={metricsQuery.isLoading}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
