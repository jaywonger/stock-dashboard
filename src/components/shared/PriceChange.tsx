import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { classForPriceDirection, formatPercent, formatPrice } from "../../lib/formatters";

interface PriceChangeProps {
  change: number;
  changePercent: number;
  compact?: boolean;
}

export function PriceChange({ change, changePercent, compact = false }: PriceChangeProps) {
  const positive = change >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={`flex items-center gap-1 ticker-font ${classForPriceDirection(change)}`}>
      <Icon size={compact ? 12 : 14} />
      <span className={compact ? "text-xs" : "text-sm"}>{formatPrice(change)}</span>
      <span className={compact ? "text-xs" : "text-sm"}>({formatPercent(changePercent)})</span>
    </div>
  );
}
