'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadTemplateFile } from '@/lib/upload';

const BARS = 160;

/** Peaks (0..1) for the waveform, from a decoded audio buffer. */
function peaksOf(buf: AudioBuffer): number[] {
  const data = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / BARS));
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    let max = 0;
    for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 8) max = Math.max(max, Math.abs(data[j]));
    out.push(max);
  }
  const top = Math.max(...out, 0.01);
  return out.map((p) => p / top);
}

/**
 * Template's own song: upload a file, pick the part (default 15 s) that plays in the video.
 * The file is stored whole; the video renderer skips into it ("seek"), so no audio processing is needed on our side.
 */
export function AudioCropper({
  windowSec, initialPath, initialUrl, initialStart,
}: { windowSec: number; initialPath: string | null; initialUrl: string | null; initialStart: number }) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [start, setStart] = useState(initialStart);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const maxStart = Math.max(0, duration - windowSec);
  const clampedStart = Math.min(start, maxStart);

  async function analyse(source: ArrayBuffer) {
    const ctx = new AudioContext();
    try {
      const buf = await ctx.decodeAudioData(source.slice(0));
      setDuration(buf.duration);
      setPeaks(peaksOf(buf));
    } finally {
      void ctx.close();
    }
  }

  // an already saved song: load it once to draw the waveform
  useEffect(() => {
    if (!initialUrl) return;
    let live = true;
    fetch(initialUrl).then((r) => r.arrayBuffer()).then(async (b) => { if (live) await analyse(b); })
      .catch(() => { if (live) setError('Could not read the saved song.'); });
    return () => { live = false; };
  }, [initialUrl]);

  useEffect(() => () => audio.current?.pause(), []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(''); stop();
    try {
      setBusy('Reading…');
      await analyse(await file.arrayBuffer());
    } catch {
      setBusy(''); setError('This file could not be read as audio. Try mp3, m4a or wav.'); return;
    }
    setBusy('Uploading…');
    const res = await uploadTemplateFile('song', file);
    setBusy('');
    if ('error' in res) { setError(res.error); return; }
    setPath(res.path);
    setUrl(URL.createObjectURL(file));
    setStart(0);
  }

  function stop() {
    audio.current?.pause();
    setPlaying(false);
  }

  function playSelection() {
    if (!url) return;
    if (playing) return stop();
    const a = (audio.current ??= new Audio());
    if (a.src !== url) a.src = url;
    a.currentTime = clampedStart;
    a.ontimeupdate = () => { if (a.currentTime >= clampedStart + windowSec) stop(); };
    a.onended = () => setPlaying(false);
    void a.play().then(() => setPlaying(true)).catch(() => setError('Could not play this file.'));
  }

  const leftPct = duration ? (clampedStart / duration) * 100 : 0;
  const widthPct = duration ? Math.min(100, (windowSec / duration) * 100) : 100;

  return (
    <div className="space-y-2">
      <input type="hidden" name="default_song_path" value={path ?? ''} />
      <input type="hidden" name="default_song_start_sec" value={clampedStart.toFixed(1)} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-glass cursor-pointer">
          {path ? 'Replace song' : 'Upload song'}
          <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,.mp3,.m4a,.wav,.aac" className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {path && (
          <button type="button" className="btn-glass" onClick={() => { setPath(null); setUrl(null); setPeaks([]); setDuration(0); stop(); }}>
            Remove
          </button>
        )}
        {busy && <span className="text-xs text-gold">{busy}</span>}
        <span className="text-xs text-ink-faint">mp3 / m4a / wav, up to 15 MB</span>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      {peaks.length > 0 && (
        <div className="space-y-2">
          <div className="relative h-16 overflow-hidden rounded-xl border border-line bg-white/[0.04]">
            <div className="absolute inset-0 flex items-center gap-px px-1" aria-hidden>
              {peaks.map((p, i) => (
                <span key={i} className="flex-1 rounded-full bg-white/40" style={{ height: `${Math.max(6, p * 100)}%` }} />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 rounded-lg border-2 border-violet bg-violet/25"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
          </div>
          <input
            type="range" min={0} max={maxStart} step={0.1} value={clampedStart} disabled={maxStart === 0}
            onChange={(e) => { stop(); setStart(Number(e.target.value)); }}
            className="w-full accent-violet" aria-label="Where the video's song starts"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <button type="button" className="btn-primary" onClick={playSelection}>{playing ? 'Stop' : `▶ Play ${windowSec}s`}</button>
            <span>Starts at <b className="text-ink">{clampedStart.toFixed(1)}s</b> · ends at <b className="text-ink">{(clampedStart + windowSec).toFixed(1)}s</b> · file is {duration.toFixed(0)}s</span>
          </div>
          {duration < windowSec && <p className="text-xs text-danger">This song is shorter than the {windowSec}s video. Pick a longer one.</p>}
        </div>
      )}
    </div>
  );
}
