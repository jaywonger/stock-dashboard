import type { NewsArticle } from "../../types";
import { formatRelativeTime } from "../../lib/formatters";

interface ArticleCardProps {
  article: NewsArticle;
}

const toneClasses = {
  bullish: "border-bullish/40 bg-bullish/10 text-bullish",
  bearish: "border-bearish/40 bg-bearish/10 text-bearish",
  neutral: "border-neutral/40 bg-neutral/10 text-neutral"
};

export function ArticleCard({ article }: ArticleCardProps) {
  const scorePct = Math.round(((article.sentimentScore + 1) / 2) * 100);
  return (
    <article className="rounded border border-border bg-surface p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">{article.source}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${toneClasses[article.sentimentLabel]}`}>
          {article.sentimentLabel}
        </span>
      </div>
      <a href={article.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold leading-5 text-text-primary hover:text-neutral">
        {article.headline}
      </a>
      <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
        <span>{formatRelativeTime(article.publishedAt)}</span>
        {article.ticker && <span className="ticker-font">{article.ticker}</span>}
      </div>
      <div className="mt-2 h-1.5 w-full rounded bg-[#1f2735]">
        <div className="h-1.5 rounded" style={{ width: `${scorePct}%`, background: scorePct >= 50 ? "#00d4aa" : "#ff4d6a" }} />
      </div>
    </article>
  );
}
