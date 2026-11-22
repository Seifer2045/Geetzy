'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin, audit } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { testKey } from '@/lib/keycheck';
import { redeployBackend, upsertEnv } from '@/lib/vercel';

export type KeyState = { ok?: boolean; error?: string; message?: string };

export async function rotateKey(_prev: KeyState, form: FormData): Promise<KeyState> {
  const admin = await assertAdmin('super'); // super admins only
  const provider = String(form.get('provider') ?? '');
  const key = String(form.get('key') ?? '').trim();
  if (key.length < 12 || /\s/.test(key)) return { error: 'That does not look like an API key.' };

  const { data: p } = await db().from('api_providers').select('provider,env_var').eq('provider', provider).maybeSingle();
  if (!p) return { error: 'Unknown provider.' };

  const valid = await testKey(provider, key);
  if (valid === false) return { error: 'The provider rejected this key. Nothing was changed.' };

  try {
    await upsertEnv(p.env_var, key);
    await redeployBackend();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Vercel update failed.' };
  }

  await db().from('api_providers').update({
    last4: key.slice(-4), rotated_at: new Date().toISOString(), rotated_by: admin.id,
    last_check_at: valid === null ? null : new Date().toISOString(), last_check_ok: valid,
  }).eq('provider', provider);
  await audit(admin.id, 'key.rotate', { type: 'api_key', id: provider }, { last4: key.slice(-4), tested: valid !== null });

  revalidatePath('/api-keys');
  return {
    ok: true,
    message: `Key saved to Vercel and the backend is redeploying (about a minute).${valid === null ? ' (No automatic test exists for this provider, so the key was not checked.)' : ''}`,
  };
}

/** Test a key without saving it. */
export async function checkKey(_prev: KeyState, form: FormData): Promise<KeyState> {
  await assertAdmin('super');
  const provider = String(form.get('provider') ?? '');
  const key = String(form.get('key') ?? '').trim();
  if (!key) return { error: 'Paste a key to test.' };
  const ok = await testKey(provider, key);
  if (ok === null) return { message: 'No automatic test for this provider.' };
  return ok ? { ok: true, message: 'Key works ✓' } : { error: 'Key rejected.' };
}
