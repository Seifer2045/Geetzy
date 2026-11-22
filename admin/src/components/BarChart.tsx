// Tiny SVG bar chart (no chart library → small bundle).
export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-ink-muted">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Videos per day">
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF4D8D" />
          <stop offset="100%" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const h = (d.value / max) * 36;
        return (
          <rect key={d.label} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={h} rx={0.6} fill="url(#bar)">
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
