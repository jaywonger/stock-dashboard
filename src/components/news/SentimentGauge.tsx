interface SentimentGaugeProps {
  score: number;
}

const colorForScore = (score: number): string => {
  if (score >= 65) return "#00d4aa";
  if (score <= 35) return "#ff4d6a";
  return "#f5a623";
};

export function SentimentGauge({ score }: SentimentGaugeProps) {
  const angle = (score / 100) * 180;
  const color = colorForScore(score);
  return (
    <div className="relative mx-auto h-24 w-40">
      <div
        className="h-20 w-40 overflow-hidden rounded-t-full border border-border"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 100%, #ff4d6a 0deg, #f5a623 90deg, #00d4aa 180deg)"
        }}
      />
      <div className="absolute inset-x-5 bottom-0 h-14 rounded-t-full border border-border bg-base" />
      <div
        className="absolute bottom-3 left-1/2 h-10 w-[2px] origin-bottom -translate-x-1/2"
        style={{ transform: `translateX(-50%) rotate(${angle - 90}deg)`, background: color }}
      />
      <div className="absolute inset-x-0 bottom-0 text-center">
        <span className="ticker-font text-lg font-semibold" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}
