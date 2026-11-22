'use client';

import { useState } from 'react';
import { uploadTemplateFile } from '@/lib/upload';

/** Optional background picture. No upload = a free gradient in the template colours. */
export function ArtUpload({
  initialPath, initialUrl, onPreview,
}: { initialPath: string | null; initialUrl: string | null; onPreview: (url: string | null) => void }) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(''); setBusy(true);
    const res = await uploadTemplateFile('art', file);
    setBusy(false);
    if ('error' in res) { setError(res.error); return; }
    const local = URL.createObjectURL(file);
    setPath(res.path); setUrl(local); onPreview(local);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="art_upload_path" value={path ?? ''} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-glass cursor-pointer">
          {path ? 'Replace background' : 'Upload background'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {path && <button type="button" className="btn-glass" onClick={() => { setPath(null); setUrl(null); onPreview(null); }}>Remove</button>}
        {busy && <span className="text-xs text-gold">Uploading…</span>}
        <span className="text-xs text-ink-faint">jpg / png / webp, up to 8 MB. Best: tall 9:16, no faces or text.</span>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Uploaded background" className="h-40 w-auto rounded-xl border border-line object-cover" />
      )}
    </div>
  );
}
