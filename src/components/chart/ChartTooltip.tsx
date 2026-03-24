interface ChartTooltipProps {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
  indicators?: Array<{ label: string; value: number | null }>;
}

export function ChartTooltip({ o, h, l, c, v, indicators = [] }: ChartTooltipProps) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 rounded border border-border bg-base/90 px-2 py-1.5 text-[11px] text-text-primary shadow-lg">
      <div className="ticker-font">O: {o?.toFixed(2) ?? "-"}</div>
      <div className="ticker-font">H: {h?.toFixed(2) ?? "-"}</div>
      <div className="ticker-font">L: {l?.toFixed(2) ?? "-"}</div>
      <div className="ticker-font">C: {c?.toFixed(2) ?? "-"}</div>
      <div className="ticker-font">Vol: {v?.toLocaleString() ?? "-"}</div>
      {indicators.length > 0 && <div className="my-1 border-t border-border" />}
      {indicators.map((item) => (
        <div key={item.label} className="ticker-font">
          {item.label}: {item.value !== null ? item.value.toFixed(2) : "-"}
        </div>
      ))}
    </div>
  );
}
