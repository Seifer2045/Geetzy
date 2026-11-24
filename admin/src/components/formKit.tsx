'use client';

import type { ReactNode } from 'react';

/** Small form building blocks used by the template page. Plain words, big targets, visible focus. */

export function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card space-y-5 p-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold">{n}</span>
        <div>
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export type Option = { value: string; label: string; hint?: string; emoji?: string | null };

/** Pick one: big tappable cards instead of a dropdown. Submits `name=value`. */
export function Choice({
  name, value, onChange, options, columns = 'sm:grid-cols-3',
}: { name: string; value: string; onChange: (v: string) => void; options: Option[]; columns?: string }) {
  return (
    <div role="radiogroup" className={`grid grid-cols-2 gap-2 ${columns}`}>
      <input type="hidden" name={name} value={value} />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`min-h-[44px] rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96] ${
              on ? 'border-violet bg-violet/20' : 'border-line bg-white/[0.04] hover:bg-white/10'}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {o.emoji && <span aria-hidden>{o.emoji}</span>}{o.label}
            </span>
            {o.hint && <span className="mt-0.5 block text-xs text-ink-muted">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** − 3 + counter. Submits `name=value`. */
export function Stepper({
  name, value, onChange, min, max,
}: { name: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const btn = 'flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/[0.06] text-xl transition-[background-color,transform] duration-150 active:scale-[0.96] hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none';
  return (
    <div className="inline-flex items-center gap-3">
      <input type="hidden" name={name} value={value} />
      <button type="button" className={btn} onClick={() => set(value - 1)} disabled={value <= min} aria-label="Less">−</button>
      <span className="w-8 text-center text-lg font-bold tabular-nums">{value}</span>
      <button type="button" className={btn} onClick={() => set(value + 1)} disabled={value >= max} aria-label="More">+</button>
    </div>
  );
}

export const THEMES: { name: string; from: string; to: string }[] = [
  { name: 'Pink party', from: '#FF4D8D', to: '#C04CF0' },
  { name: 'Sunset', from: '#FF8A5C', to: '#E0306E' },
  { name: 'Ocean', from: '#2BB5FF', to: '#5B5BFF' },
  { name: 'Mint', from: '#2BD97C', to: '#0E8F7E' },
  { name: 'Golden', from: '#FFC857', to: '#FF7A3D' },
  { name: 'Royal', from: '#7C5CFF', to: '#2A1B6B' },
  { name: 'Rose', from: '#FF9EBB', to: '#C2185B' },
  { name: 'Night', from: '#3A2C6B', to: '#0A0A0F' },
];

/** Ready-made colour themes + two custom pickers. Submits color_from / color_to. */
export function ColorThemes({
  from, to, onChange,
}: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return (
    <div className="space-y-3">
      <input type="hidden" name="color_from" value={from} />
      <input type="hidden" name="color_to" value={to} />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {THEMES.map((t) => {
          const on = same(t.from, from) && same(t.to, to);
          return (
            <button
              key={t.name} type="button" title={t.name} aria-label={t.name} aria-pressed={on} onClick={() => onChange(t.from, t.to)}
              className={`h-11 rounded-xl border-2 transition-[border-color,transform] duration-150 active:scale-[0.96] ${on ? 'border-white' : 'border-transparent hover:border-white/40'}`}
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          <input type="color" value={from} onChange={(e) => onChange(e.target.value, to)} className="swatch" aria-label="Top colour" /> Top colour
        </label>
        <label className="flex items-center gap-2">
          <input type="color" value={to} onChange={(e) => onChange(from, e.target.value)} className="swatch" aria-label="Bottom colour" /> Bottom colour
        </label>
      </div>
    </div>
  );
}

/** Collapsed block for rarely used settings. Content stays in the form even when closed. */
export function More({ title, hint, defaultOpen, children }: { title: string; hint?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="card group p-5">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="block text-base font-bold">{title}</span>
          {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
        </span>
        <span className="text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="mt-4 space-y-5">{children}</div>
    </details>
  );
}
