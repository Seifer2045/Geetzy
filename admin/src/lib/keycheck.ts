import 'server-only';

/** Cheap "is this key accepted?" calls, run BEFORE a new key is saved. null = no safe test exists. */
export async function testKey(provider: string, key: string): Promise<boolean | null> {
  try {
    if (provider === 'elevenlabs') {
      // only an explicit "invalid key" answer counts as bad (restricted keys may lack permission for /models)
      const r = await fetch('https://api.elevenlabs.io/v1/models', { headers: { 'xi-api-key': key }, cache: 'no-store' });
      if (r.ok) return true;
      const body = await r.text();
      return !(r.status === 401 && /invalid_api_key/i.test(body));
    }
    if (provider === 'xai') {
      const r = await fetch('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      return r.ok;
    }
    if (provider === 'json2video') {
      // 401/403 = bad key; anything else (e.g. 404 for an unknown project) = key accepted
      const r = await fetch('https://api.json2video.com/v2/movies?project=geetzy-key-check', {
        headers: { 'x-api-key': key }, cache: 'no-store',
      });
      return r.status !== 401 && r.status !== 403;
    }
    return null;
  } catch {
    return false;
  }
}
