'use client';

import { useEffect, useState, useTransition } from 'react';
import { generateArt, generatePreview, getStudioStatus, setPublished, type StudioStatus } from '@/app/(dash)/templates/actions';
import type { SlotShape } from './LayoutPicker';

const BUSY = ['queued', 'running'];
const busy = (s: StudioStatus) => BUSY.includes(s.art_status) || BUSY.includes(s.preview_status);

const LABEL: Record<string, string> = { none: 'Not made yet', queued: 'Starting…', running: 'Working…', ready: 'Ready', error: 'Failed' };
const COLOR: Record<string, string> = { none: 'text-ink-faint', queued: 'text-gold', running: 'text-gold', ready: 'text-ok', error: 'text-danger' };

function Badge({ s }: { s: string }) {
  return <span className={`pill ${COLOR[s] ?? ''}`}>{LABEL[s] ?? s}</span>;
}

/** Art, preview and publish for one saved template. Polls ONE small row every 3 s while a job is running. */
export function StudioPanel({
  id, initial, slots, isImage,
}: { id: string; initial: StudioStatus; slots: SlotShape[]; isImage: boolean }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!busy(s)) return;
    const timer = setInterval(async () => {
      const next = await getStudioStatus(id);
      if (next) setS(next);
    }, 3000);
    return () => clearInterval(timer);
  }, [s, id]);

  function run(action: () => Promise<{ error?: string }>, optimistic: Partial<StudioStatus>) {
    setMsg('');
    start(async () => {
      const res = await action();
      if (res.error) { setMsg(res.error); return; }
      setS((cur) => ({ ...cur, ...optimistic }));
      const next = await getStudioStatus(id);
      if (next) setS(next);
    });
  }

  const artBusy = BUSY.includes(s.art_status);
  const previewBusy = BUSY.includes(s.preview_status);
  const ready = s.art_status === 'ready' && s.preview_status === 'ready';
  const published = s.status === 'published';

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-2">Real preview &amp; publish</h2>
        <span className={`pill ${published ? 'text-ok' : 'text-gold'}`}>{published ? 'Published' : 'Draft'}</span>
      </div>
      <p className="text-xs text-ink-faint">Works on the saved version — press <b>Save changes</b> first if you edited the form. A video preview costs about 15 JSON2Video credits (and one ElevenLabs song if the template uses an AI song).</p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ART */}
        <div className="space-y-3">
          <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">1. Background &amp; frames</h3><Badge s={s.art_status} /></div>
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl border border-line bg-white/5">
            {s.art_bg_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={s.art_bg_url} alt="Template art" className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center p-4 text-center text-xs text-ink-faint">No art yet</div>}
            {s.art_bg_url && (
              <svg viewBox="0 0 108 192" className="absolute inset-0 h-full w-full" aria-hidden>
                {slots.map((sl, i) => {
                  const w = sl.w * 108, h = sl.h * 192, x = sl.x * 108, y = sl.y * 192;
                  return (
                    <g key={i} transform={sl.rotate ? `rotate(${sl.rotate} ${x + w / 2} ${y + h / 2})` : undefined}>
                      <rect x={x} y={y} width={w} height={h} rx={(sl.radius ?? 0.05) * Math.min(w, h)} fill="rgba(0,0,0,0.25)" stroke="#fff" strokeWidth="1.4" strokeDasharray="3 2" />
                      <text x={x + w / 2} y={y + h / 2} fontSize="6" fill="#fff" textAnchor="middle" dominantBaseline="middle">Photo {i + 1}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
          {s.art_error && <p className="text-xs text-danger">{s.art_error}</p>}
          <button className="btn-primary w-full" disabled={pending || artBusy}
            onClick={() => run(() => generateArt(id), { art_status: 'queued', art_error: null })}>
            {artBusy ? 'Building… (a few seconds)' : s.art_status === 'ready' ? 'Rebuild (free)' : 'Build background (free)'}
          </button>
          {s.art_status === 'ready' && <p className="text-xs text-ink-faint">A new background needs a new preview and a new publish.</p>}
        </div>

        {/* PREVIEW + PUBLISH */}
        <div className="space-y-3">
          <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">2. Preview</h3><Badge s={s.preview_status} /></div>
          <div className="mx-auto flex aspect-[9/16] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-line bg-white/5">
            {s.preview_url && s.preview_status === 'ready'
              ? s.preview_type === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.preview_url} alt="Preview" className="h-full w-full object-cover" />
                : <video key={s.preview_url} src={s.preview_url} controls playsInline loop className="h-full w-full object-cover" />
              : <span className="p-4 text-center text-xs text-ink-faint">{isImage ? 'Preview uses sample photos' : 'The preview uses sample photos, a sample name and the song (AI song from your prompt, or your own)'}</span>}
          </div>
          {!isImage && s.preview_status === 'ready' && <p className="text-xs text-ink-faint">Press play: the preview includes the song. Sound is on.</p>}
          {s.preview_error && <p className="text-xs text-danger">{s.preview_error}</p>}
          <button className="btn-glass w-full" disabled={pending || previewBusy || s.art_status !== 'ready'}
            onClick={() => run(() => generatePreview(id), { preview_status: 'queued', preview_error: null })}>
            {previewBusy ? (isImage ? 'Making preview…' : 'Rendering video… (about a minute)') : s.preview_status === 'ready' ? 'Regenerate preview' : 'Generate preview'}
          </button>

          <h3 className="pt-2 text-sm font-semibold">3. Publish</h3>
          {published ? (
            <button className="btn-danger w-full" disabled={pending} onClick={() => run(() => setPublished(id, false), { status: 'draft' })}>Unpublish (back to draft)</button>
          ) : (
            <button className="btn-primary w-full" disabled={pending || !ready} onClick={() => run(() => setPublished(id, true), { status: 'published' })}>
              Publish to the app
            </button>
          )}
          {!published && !ready && <p className="text-xs text-ink-faint">Needs a built background and a ready preview.</p>}
        </div>
      </div>
      {msg && <p className="text-sm text-danger">{msg}</p>}
    </section>
  );
}
