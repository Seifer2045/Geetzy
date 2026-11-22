'use client';

import { useEffect, useState, useTransition } from 'react';
import { generateMovie, getStudioStatus, validateMovie } from '@/app/(dash)/templates/actions';

const BUSY = ['queued', 'running'];
const LABEL: Record<string, string> = { none: 'Built-in design', queued: 'Starting…', running: 'Grok is designing…', ready: 'Ready', error: 'Failed' };
const COLOR: Record<string, string> = { none: 'text-ink-faint', queued: 'text-gold', running: 'text-gold', ready: 'text-ok', error: 'text-danger' };

/**
 * Video design: the admin describes the video, Grok (xAI) writes a JSON movie template, the admin can edit it.
 * The JSON is what JSON2Video renders for every gift: which photo, text and sound goes where. Grok runs once per click.
 */
export function MovieDesigner({
  id, initialPrompt, initialJson, initialStatus, initialError, photosMin, photosMax,
}: {
  id?: string; initialPrompt: string; initialJson: string; initialStatus: string; initialError: string | null;
  photosMin: number; photosMax: number;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [json, setJson] = useState(initialJson);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState(initialError ?? '');
  const [problems, setProblems] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  // while Grok works, ask for one small row every 3 s; when it is done, show the new JSON
  useEffect(() => {
    if (!id || !BUSY.includes(status)) return;
    const timer = setInterval(async () => {
      const next = await getStudioStatus(id);
      if (!next) return;
      setStatus(next.movie_status);
      setError(next.movie_error ?? '');
      if (next.movie_status === 'ready' && next.movie_json) { setJson(next.movie_json); setProblems(null); }
    }, 3000);
    return () => clearInterval(timer);
  }, [id, status]);

  function generate(force: boolean) {
    if (!id) return;
    setError(''); setProblems(null);
    start(async () => {
      const res = await generateMovie(id, prompt, force);
      if (res.error) { setError(res.error); return; }
      setStatus('queued');
    });
  }

  function validate() {
    start(async () => {
      const res = await validateMovie(json, photosMin, photosMax);
      setProblems(res.errors);
    });
  }

  const busy = BUSY.includes(status);
  const hasJson = json.trim().length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Video design (Grok writes it as JSON)</h3>
        <span className={`pill ${COLOR[hasJson && status === 'none' ? 'ready' : status] ?? ''}`}>
          {hasJson && status === 'none' ? 'Custom JSON' : LABEL[status] ?? status}
        </span>
      </div>
      <p className="text-xs text-ink-faint">
        Describe the look: scenes, text, mood, transitions. Grok turns it into a JSON template with markers like <code>{'{{photo_1}}'}</code>,{' '}
        <code>{'{{name}}'}</code> and <code>{'{{audio}}'}</code>. JSON2Video then renders that JSON for every video, so the photos, names and song change but
        the design stays. Grok is called once per click, never when a user makes a video. Leave it empty to use the built-in design.
      </p>

      <textarea
        name="movie_prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={1500} className="input"
        placeholder={'e.g. "Royal Bollywood wedding feel. Each photo in a gold frame, title on the first scene, the fun fact on the middle scenes, a warm wish from the sender at the end. Slow fades, big elegant text."'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={!id || pending || busy || prompt.trim().length < 10} onClick={() => generate(false)}>
          {busy ? 'Grok is working…' : hasJson ? 'Update design with Grok' : 'Generate with Grok'}
        </button>
        {hasJson && !busy && (
          <button type="button" className="btn-glass" disabled={!id || pending} onClick={() => generate(true)}>New design anyway</button>
        )}
        {!id && <span className="text-xs text-ink-faint">Save the template first, then Grok can design it.</span>}
        {id && !busy && <span className="text-xs text-ink-faint">Same brief and settings = no new Grok call.</span>}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      <div>
        <label className="label" htmlFor="movie_json">Design JSON (you can edit it)</label>
        <textarea
          id="movie_json" name="movie_json" value={json} onChange={(e) => { setJson(e.target.value); setProblems(null); }}
          rows={json ? 16 : 5} spellCheck={false} className="input font-mono text-xs"
          placeholder={'Empty = built-in design. Paste your own JSON here, or let Grok write it.'}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-glass" disabled={pending || !hasJson} onClick={validate}>Validate</button>
          {hasJson && (
            <button type="button" className="btn-glass" disabled={busy} onClick={() => { setJson(''); setProblems(null); }}>Use built-in design</button>
          )}
          {problems && problems.length === 0 && <span className="text-xs text-ok">Looks good ✓ ({photosMin}–{photosMax} photos)</span>}
        </div>
        {problems && problems.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-danger">
            {problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
        <p className="mt-1 text-xs text-ink-faint">
          Rules: only image, text and audio; photos/sound only as markers (no web links); sizes as fractions of the picture. Press <b>Save</b> to keep changes.
        </p>
      </div>
    </div>
  );
}
