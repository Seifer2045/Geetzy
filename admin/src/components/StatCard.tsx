export function StatCard({
  label, value, hint, accent,
}: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${accent ? 'text-gold' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
