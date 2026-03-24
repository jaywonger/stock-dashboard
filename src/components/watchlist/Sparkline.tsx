interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 84, height = 24 }: SparklineProps) {
  if (!values.length) return <div className="h-6 w-20 rounded bg-[#1a2230]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const color = values[values.length - 1] >= values[0] ? "#00d4aa" : "#ff4d6a";
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={points} />
    </svg>
  );
}
