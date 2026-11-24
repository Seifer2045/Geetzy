'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { generateSong, getStudioStatus, removeSong, validateSong } from '@/app/(dash)/templates/actions';

const BUSY = ['queued', 'running'];
const LABEL: Record<string, string> = { none: 'No shared song', queued: 'Starting…', running: 'ElevenLabs is composing…', ready: 'Ready', error: 'Failed' };
const COLOR: Record<string, string> = { none: 'text-ink-faint', queued: 'text-gold', running: 'text-gold', ready: 'text-ok', error: 'text-danger' };

/**
 * Shared song: ElevenLabs makes ONE song for the whole template (no name inside). The JSON says where the person's
 * name is spoken over it; JSON2Video adds the voice for every gift, so no ElevenLabs cost per video.
 */
export function SongDesigner({
  id, initialJson, initialStatus, initialError, durationSec, songUrl,
}: {
  id?: string; initialJson: string; initialStatus: string; initialError: string | null; durationSec: number; songUrl: string | null;
}) {
  const router = useRouter();
  const [json, setJson] = useState(initialJson);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState(initialError ?? '');
  const [problems, setProblems] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  // while ElevenLabs works, ask for one small row every 3 s; when it is done, show the new JSON and the new audio
  useEffect(() => {
    if (!id || !BUSY.includes(status)) return;
    const timer = setInterval(async () => {
      const next = await getStudioStatus(id);
      if (!next) return;
      setStatus(next.song_status);
      setError(next.song_error ?? '');
      if (next.song_status === 'ready') {
        if (next.song_json) setJson(next.song_json);
        setProblems(null);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [id, status, router]);

  function generate() {
    if (!id) return;
    setError(''); setProblems(null);
    start(async () => {
      const res = await generateSong(id);
      if (res.error) { setError(res.error); return; }
      setStatus('queued');
    });
  }

  function remove() {
    if (!id || !window.confirm('Remove the shared song? Users will pick their own song again.')) return;
    start(async () => {
      const res = await removeSong(id);
      if (res.error) { setError(res.error); return; }
      setStatus('none'); setJson(''); setProblems(null);
      router.refresh();
    });
  }

  function validate() {
    start(async () => {
      const res = await validateSong(json, durationSec);
      setProblems(res.errors);
    });
  }

  const busy = BUSY.includes(status);
  const ready = status === 'ready' && json.trim().length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Shared song + spoken name</h3>
        <span className={`pill ${COLOR[status] ?? ''}`}>{LABEL[status] ?? status}</span>
      </div>
      <p className="text-xs text-ink-faint">
        ElevenLabs makes <b>one</b> song for this template from the “song idea” above (placeholders like <code>{'{name}'}</code> are left out).
        Every video then uses it, and JSON2Video <b>speaks the person’s name</b> over it at the times in the JSON below. You pay ElevenLabs once, not per video.
        Users will not pick a song for this template.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={!id || pending || busy} onClick={generate}>
          {busy ? 'Making the song…' : ready ? 'Make a new song' : 'Generate shared song'}
        </button>
        {ready && !busy && <button type="button" className="btn-glass" disabled={pending} onClick={remove}>Remove shared song</button>}
        {!id && <span className="text-xs text-ink-faint">Save the template first.</span>}
        {id && !ready && !busy && <span className="text-xs text-ink-faint">Write the song idea above and press Save first.</span>}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {ready && songUrl && <audio controls src={songUrl} className="w-full" />}

      {(ready || json) && (
        <div>
          <label className="label" htmlFor="song_json">Song JSON (sections and where the name is spoken)</label>
          <textarea
            id="song_json" name="song_json" value={json} onChange={(e) => { setJson(e.target.value); setProblems(null); }}
            rows={12} spellCheck={false} className="input font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-glass" disabled={pending || !json.trim()} onClick={validate}>Validate</button>
            {problems && problems.length === 0 && <span className="text-xs text-ok">Looks good ✓ ({durationSec} s)</span>}
          </div>
          {problems && problems.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-danger">
              {problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
          <p className="mt-1 text-xs text-ink-faint">
            <code>name_slots[].at</code> = the second the name is spoken (max 3), <code>text</code> may use <code>{'{{name}}'}</code> and <code>{'{{sender}}'}</code>.
            Moving a slot only needs <b>Save</b> (no new song). Changing the song idea needs <b>Make a new song</b>. After either, make the preview again.
          </p>
        </div>
      )}
    </div>
  );
}
