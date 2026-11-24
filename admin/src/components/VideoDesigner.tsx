'use client';

import { useEffect, useState, useTransition } from 'react';
import { listPresets, loadPreset, validateMovie } from '@/app/(dash)/templates/actions';
import type { PresetSummary } from '@/lib/backend';

const PLACEHOLDERS: { code: string; what: string }[] = [
  { code: '{{photo_1}}', what: 'the user\'s photo 1 (use it as the "src" of an image; photo_2, photo_3 … for the next ones)' },
  { code: '{{name}}', what: 'who the gift is for (inside any text)' },
  { code: '{{sender}}', what: 'who sends it' },
  { code: '{{fun_fact}}', what: 'the fun fact the user typed' },
  { code: '{{occasion}}', what: 'Birthday, Anniversary…' },
  { code: '{{audio}}', what: 'the song (as the "src" of an audio element; added automatically if you forget)' },
  { code: '{{background}}', what: 'this template\'s background picture (as the "src" of an image)' },
];

/**
 * The video design: JSON2Video JSON. Start from one of our starter templates, or design in the JSON2Video Editor and paste the JSON.
 * The backend swaps the placeholders (photos, names, song) for every video, drops scenes whose photos the user did not add,
 * and adds the watermark on previews. The saved JSON is what every gift is rendered from.
 */
export function VideoDesigner({
  id, initialJson, photosMin, photosMax, onPhotos,
}: {
  id?: string; initialJson: string; photosMin: number; photosMax: number; onPhotos: (min: number, max: number) => void;
}) {
  const [json, setJson] = useState(initialJson);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [presetError, setPresetError] = useState('');
  const [picked, setPicked] = useState('');
  const [problems, setProblems] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void listPresets().then((res) => {
      if (!alive) return;
      setPresets(res.presets);
      if (res.error) setPresetError(res.error);
    });
    return () => { alive = false; };
  }, []);

  const hasJson = json.trim().length > 0;

  function useStarter(pid: string) {
    if (hasJson && !window.confirm('Replace the current design with this starter template?')) return;
    setError(''); setMessage(''); setProblems(null); setPicked(pid);
    start(async () => {
      const res = await loadPreset(pid);
      if (res.error || !res.json) { setError(res.error ?? 'Could not load it.'); return; }
      setJson(res.json);
      if (res.photosMin && res.photosMax) onPhotos(res.photosMin, res.photosMax);
      setMessage(`"${res.name}" loaded (${res.photosMin}–${res.photosMax} photos). Press Save, then make the preview.`);
    });
  }

  function validate() {
    setError(''); setMessage('');
    start(async () => {
      const res = await validateMovie(json, photosMin, photosMax);
      setProblems(res.errors);
    });
  }

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 1200); } catch { /* clipboard not available */ }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white/[0.03] p-3">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Start from a starter template</h3>
        {presetError && <p className="text-xs text-danger">{presetError}</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => (
            <button
              type="button" key={p.id} onClick={() => useStarter(p.id)} disabled={pending} aria-pressed={picked === p.id}
              className={`card p-3 text-left text-xs transition ${picked === p.id ? 'border-violet bg-white/10' : 'hover:bg-white/10'}`}
            >
              <span className="block text-sm font-semibold text-ink">{p.name}</span>
              <span className="block text-ink-muted">{p.description}</span>
              <span className="mt-1 block text-ink-faint">{p.photos_min === p.photos_max ? `${p.photos_min} photos` : `${p.photos_min}–${p.photos_max} photos`}</span>
            </button>
          ))}
          {presets.length === 0 && !presetError && <p className="text-xs text-ink-faint">Loading starter templates…</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="movie_json">Design JSON (paste from the JSON2Video Editor, or edit a starter)</label>
        <textarea
          id="movie_json" name="movie_json" value={json} onChange={(e) => { setJson(e.target.value); setProblems(null); setMessage(''); }}
          rows={json ? 18 : 6} spellCheck={false} className="input font-mono text-xs"
          placeholder={'Empty = the built-in simple design. Pick a starter above or paste your own JSON here.'}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-glass" disabled={pending || !hasJson} onClick={validate}>Validate</button>
          {hasJson && <button type="button" className="btn-glass" onClick={() => { setJson(''); setProblems(null); setPicked(''); setMessage(''); }}>Use built-in design</button>}
          {problems && problems.length === 0 && <span className="text-xs text-ok">Looks good ✓ ({photosMin}–{photosMax} photos)</span>}
          {!id && <span className="text-xs text-ink-faint">Save the template to render a preview with the song.</span>}
        </div>
        {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
        {message && <p className="mt-2 text-xs text-ok" role="status">{message}</p>}
        {problems && problems.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-danger">
            {problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
      </div>

      <details className="rounded-xl border border-line p-3 text-xs text-ink-muted">
        <summary className="cursor-pointer font-semibold text-ink">How to design it in JSON2Video (steps and placeholders)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open <b>json2video.com/editor</b> and make the video. Set the canvas to <b>1080 × 1920</b>. Add your styles, text animations, transitions, overlays, an intro and an outro. Give every scene a fixed <b>duration</b> in seconds.</li>
          <li>Where a user photo goes, add an image and set its <b>src</b> to <code>{'{{photo_1}}'}</code>, then <code>{'{{photo_2}}'}</code> and so on. Set its position and size: that is the frame the photo is cut to, with the face kept in view.</li>
          <li>Where the name goes, write it in the text, for example <code>Happy Birthday {'{{name}}'}</code>.</li>
          <li>Copy the movie JSON, paste it above, press <b>Validate</b>, then <b>Save</b> and make the preview. The preview plays the template with the song.</li>
        </ol>
        <p className="mt-2">Scenes that use a photo the user did not add are removed automatically and the others are stretched to the video length. Not supported: JSON2Video variables, conditions and repeating scenes (write each scene out).</p>
        <ul className="mt-2 space-y-1">
          {PLACEHOLDERS.map((p) => (
            <li key={p.code} className="flex flex-wrap items-center gap-2">
              <button type="button" className="rounded-md border border-line px-2 py-0.5 font-mono text-ink hover:bg-white/10" onClick={() => void copy(p.code)}>
                {copied === p.code ? 'copied ✓' : p.code}
              </button>
              <span>{p.what}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
