'use client';

import { useRef } from 'react';
import { PLACEHOLDERS, SAMPLE, fillExample } from '@/lib/placeholders';

/** Textarea + clickable placeholder chips + a live "example for Priya" so the admin sees what users will get. */
export function PromptField({
  name, label, value, onChange, placeholder, keys, help, maxLength,
}: {
  name: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keys: ReadonlyArray<(typeof PLACEHOLDERS)[number]['key']>; help?: string; maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insert(key: string) {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) return onChange(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  }

  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea
        id={name} name={name} ref={ref} value={value} onChange={(e) => onChange(e.target.value)}
        rows={5} maxLength={maxLength} className="input" placeholder={placeholder}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-faint">Insert:</span>
        {PLACEHOLDERS.filter((p) => keys.includes(p.key)).map((p) => (
          <button type="button" key={p.key} onClick={() => insert(p.key)} title={p.hint} className="pill font-mono hover:bg-white/10">
            {`{${p.key}}`}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-faint">{maxLength ? `${value.length}/${maxLength}` : `${value.length} characters`}</span>
      </div>
      {help && <p className="mt-1 text-xs text-ink-faint">{help}</p>}
      {value.trim() && keys.length > 1 && (
        <p className="mt-2 rounded-xl border border-line bg-white/[0.04] p-2 text-xs text-ink-2">
          <span className="font-semibold text-ink-muted">Example for {SAMPLE.name}: </span>
          {fillExample(value)}
        </p>
      )}
    </div>
  );
}
