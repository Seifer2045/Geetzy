'use client';

export type SlotShape = { x: number; y: number; w: number; h: number; radius?: number; rotate?: number };
/** Video layout with no decorative frame (id of the row in the layouts table). */
export const FREE_LAYOUT = 'free';
export type LayoutOption = { id: string; name: string; kind: 'video' | 'image'; slots: SlotShape[]; photo_count: number };

/** A 9:16 sketch of the layout: each rectangle is where one user photo goes. */
export function LayoutSketch({ slots, className = '' }: { slots: SlotShape[]; className?: string }) {
  return (
    <svg viewBox="0 0 108 192" className={className} role="img" aria-label={`${slots.length} photo slot(s)`}>
      <rect width="108" height="192" rx="6" fill="rgba(255,255,255,0.06)" />
      {slots.map((s, i) => {
        const w = s.w * 108, h = s.h * 192, x = s.x * 108, y = s.y * 192;
        return (
          <rect
            key={i} x={x} y={y} width={w} height={h} rx={(s.radius ?? 0.05) * Math.min(w, h)}
            fill="rgba(124,92,255,0.55)" stroke="#fff" strokeWidth="1.2"
            transform={s.rotate ? `rotate(${s.rotate} ${x + w / 2} ${y + h / 2})` : undefined}
          />
        );
      })}
      <rect x="14" y="164" width="80" height="6" rx="3" fill="rgba(255,255,255,0.35)" />
      <rect x="28" y="175" width="52" height="4" rx="2" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

export function LayoutPicker({
  layouts, value, onChange, allowNone,
}: { layouts: LayoutOption[]; value: string; onChange: (id: string) => void; allowNone?: boolean }) {
  return (
    <div>
      <input type="hidden" name="layout_id" value={value} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {allowNone && (
          <button
            type="button" onClick={() => onChange('')}
            className={`card p-2 text-center text-xs ${value === '' ? 'border-violet bg-white/10' : ''}`}
          >
            <div className="flex aspect-[9/16] items-center justify-center rounded-lg bg-white/5 text-ink-muted">Classic slideshow</div>
            <span className="mt-1 block text-ink-muted">No layout</span>
          </button>
        )}
        {layouts.map((l) => (
          <button
            type="button" key={l.id} onClick={() => onChange(l.id)} aria-pressed={value === l.id}
            className={`card p-2 text-center text-xs transition ${value === l.id ? 'border-violet bg-white/10 shadow-glow' : 'hover:bg-white/10'}`}
          >
            {l.id === FREE_LAYOUT
              ? <div className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-line px-1 text-[11px] text-ink-muted">Photos placed by the design</div>
              : <LayoutSketch slots={l.slots} className="w-full" />}
            <span className="mt-1 block font-semibold text-ink">{l.name}</span>
            <span className="text-ink-faint">{l.id === FREE_LAYOUT ? 'recommended' : `${l.photo_count} photo${l.photo_count > 1 ? 's' : ''}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
