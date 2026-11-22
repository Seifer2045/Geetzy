import 'server-only';

/** Asks the FastAPI backend to check a movie template (one set of rules for Grok output and hand-edited JSON). */
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
