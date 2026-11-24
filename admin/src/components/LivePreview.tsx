'use client';

import { useEffect, useState } from 'react';
import { SAMPLE, fillExample } from '@/lib/placeholders';
import type { SlotShape } from './LayoutPicker';

export type PreviewProps = {
  name: string; emoji: string; categoryName: string; colorFrom: string; colorTo: string;
  slots: SlotShape[]; isImage: boolean; photosMin: number; photosMax: number; durationSec: number;
  videoPrompt: string; price: number | null; originalPrice: number | null; bgUrl: string | null;
  songLabel: string; description: string;
};

const SAMPLE_PHOTO = ['#FF8FB1', '#9B7BFF', '#FFC857', '#59D0B5', '#7CB8FF'];

/** Instant, client-only mock of the template (no credits). The real render is made by the "Generate preview" button. */
export function LivePreview(p: PreviewProps) {
  const sceneCount = p.isImage ? 1 : Math.max(1, p.photosMax);
  const [scene, setScene] = useState(0);
  const [play, setPlay] = useState(false);
  const current = Math.min(scene, sceneCount - 1);

  useEffect(() => {
    if (!play || sceneCount < 2) return;
    const t = setInterval(() => setScene((s) => (s + 1) % sceneCount), 1200);
    return () => clearInterval(t);
  }, [play, sceneCount]);

  const lines = p.videoPrompt.trim() ? fillExample(p.videoPrompt).split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const headline = lines[0] || `Happy ${p.categoryName || 'Birthday'}, ${SAMPLE.name}!`;
  const closing = lines[1] || `With love, ${SAMPLE.sender}`;
  const caption = p.isImage ? `For ${SAMPLE.name}, from ${SAMPLE.sender}` : current === 0 ? headline : current === sceneCount - 1 && sceneCount > 1 ? closing : '♪ ♪ ♪';
  const slots = p.isImage ? p.slots : p.slots.slice(0, 1);
  const sceneLen = p.durationSec / sceneCount;

  return (
    <div className="space-y-4">
      <div>
        <div className="relative mx-auto aspect-[9/16] w-[220px] overflow-hidden rounded-[28px] border-4 border-white/15 shadow-glow"
          style={{ background: `linear-gradient(180deg, ${p.colorFrom}, ${p.colorTo})` }}>
          {p.bgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <svg viewBox="0 0 108 192" className="absolute inset-0 h-full w-full" aria-hidden>
            {slots.map((s, i) => {
              const w = s.w * 108, h = s.h * 192, x = s.x * 108, y = s.y * 192;
              const idx = p.isImage ? i : current;
              return (
                <g key={i} transform={s.rotate ? `rotate(${s.rotate} ${x + w / 2} ${y + h / 2})` : undefined}>
                  <rect x={x - 1.2} y={y - 1.2} width={w + 2.4} height={h + 2.4} rx={(s.radius ?? 0.05) * Math.min(w, h) + 1.2} fill="#fff" />
                  <rect x={x} y={y} width={w} height={h} rx={(s.radius ?? 0.05) * Math.min(w, h)} fill={SAMPLE_PHOTO[idx % SAMPLE_PHOTO.length]} />
                  <text x={x + w / 2} y={y + h / 2} fontSize="7" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                    {p.isImage ? `Photo ${i + 1}` : `Photo ${current + 1}`}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="absolute inset-x-0 bottom-[16%] px-3 text-center text-[15px] font-extrabold leading-tight text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>
            {caption}
          </div>
          <div className="absolute inset-x-0 top-[3%] text-center text-[10px] font-bold tracking-widest text-white/50">GEETZY · PREVIEW</div>
          {p.price !== null && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-gold">
              ₹{p.price}{p.originalPrice ? <s className="ml-1 text-white/50">₹{p.originalPrice}</s> : null}
            </div>
          )}
          <div className="absolute bottom-3 left-3 text-lg" aria-hidden>{p.emoji}</div>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="font-semibold">{p.name || 'Template name'}</p>
          <p className="text-xs text-ink-muted">{p.description || 'Short description shown in the app'}</p>
        </div>
        {!p.isImage && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-glass" onClick={() => setPlay((v) => !v)}>{play ? 'Pause' : '▶ Play scenes'}</button>
              <span className="text-xs text-ink-muted">Scene {current + 1} of {sceneCount} · {sceneLen.toFixed(1)}s each · {p.durationSec}s total</span>
            </div>
            <div className="flex gap-1" role="tablist" aria-label="Scenes">
              {Array.from({ length: sceneCount }).map((_, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === current} onClick={() => { setPlay(false); setScene(i); }}
                  className={`h-2 flex-1 rounded-full ${i === current ? 'bg-violet' : 'bg-white/15'}`} aria-label={`Scene ${i + 1}`} />
              ))}
            </div>
            <p className="text-xs text-ink-faint">
              The app lets users add {p.photosMin === p.photosMax ? p.photosMin : `${p.photosMin} to ${p.photosMax}`} photo(s). Each photo is one scene;
              this mock shows the most scenes ({sceneCount}).
            </p>
          </>
        )}
        <ul className="space-y-1 text-xs text-ink-muted">
          <li>🎵 Song: <b className="text-ink">{p.songLabel}</b></li>
          <li>💰 Price in the app: <b className="text-ink">{p.price === null ? '—' : `₹${p.price}`}</b></li>
          <li>🖼 Background: <b className="text-ink">{p.bgUrl ? 'your upload' : 'gradient from the two colours'}</b></li>
        </ul>
        <p className="rounded-xl border border-line bg-white/[0.04] p-2 text-xs text-ink-faint">
          This is a quick sketch to check text, colours and photo frames. If you use a JSON2Video design, the real look comes from its JSON. Use <b>Save &amp; generate preview</b> below to render the real video
          (costs about {p.durationSec} JSON2Video credits{p.songLabel.startsWith('AI') ? ' and one ElevenLabs song' : ''}).
        </p>
      </div>
    </div>
  );
}
