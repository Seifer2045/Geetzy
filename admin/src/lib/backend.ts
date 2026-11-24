import 'server-only';

/** Asks the backend to check a song spec (the shared song: sections + where the name is spoken). */
export async function validateSongJson(spec: unknown, durationSec: number): Promise<string[]> {
  const base = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) {
    return ['The admin needs BACKEND_URL and INTERNAL_SECRET in its environment to check the JSON (see docs/ADMIN_SETUP.md).'];
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/internal/song/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ spec, duration_sec: durationSec }),
      cache: 'no-store',
    });
    if (!res.ok) return [`The backend could not check the song JSON (${res.status}). Is it deployed with the latest code?`];
    const data = (await res.json()) as { errors?: string[] };
    return data.errors ?? [];
  } catch {
    return ['Could not reach the backend to check the song JSON. Try again.'];
  }
}

/** Asks the FastAPI backend to check a video design (JSON2Video JSON from the Editor or a starter; also the older compact format). */
export async function validateMovieJson(movie: unknown, photosMin: number, photosMax: number): Promise<string[]> {
  const base = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) {
    return ['The admin needs BACKEND_URL and INTERNAL_SECRET in its environment to check the JSON (see docs/ADMIN_SETUP.md).'];
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/internal/movie/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ movie, photos_min: photosMin, photos_max: photosMax }),
      cache: 'no-store',
    });
    if (!res.ok) return [`The backend could not check the JSON (${res.status}). Is it deployed with the latest code?`];
    const data = (await res.json()) as { errors?: string[] };
    return data.errors ?? [];
  } catch {
    return ['Could not reach the backend to check the JSON. Try again.'];
  }
}

export type PresetSummary = { id: string; name: string; style: string; occasion: string; photos_min: number; photos_max: number; description: string };
export type Preset = PresetSummary & { movie: unknown };

async function internal<T>(path: string): Promise<T | null> {
  const base = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, { headers: { 'x-internal-secret': secret }, cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The starter templates (royal birthday, romantic anniversary…). null = the backend could not be reached. */
export async function fetchPresets(): Promise<PresetSummary[] | null> {
  const data = await internal<{ presets: PresetSummary[] }>('/internal/presets');
  return data ? data.presets : null;
}

export async function fetchPreset(id: string): Promise<Preset | null> {
  return internal<Preset>(`/internal/presets/${encodeURIComponent(id)}`);
}
