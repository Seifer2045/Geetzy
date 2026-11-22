'use client';

import { createClient } from '@supabase/supabase-js';
import { createUploadUrl } from '@/app/(dash)/templates/actions';
import { TEMPLATE_BUCKET } from '@/lib/storage';

/** Uploads straight from the browser to Supabase Storage (big audio files must not pass through a server action). */
export async function uploadTemplateFile(kind: 'art' | 'song', file: File): Promise<{ path: string } | { error: string }> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const signed = await createUploadUrl(kind, ext, file.type, file.size);
  if ('error' in signed) return signed;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.storage.from(TEMPLATE_BUCKET).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  return error ? { error: error.message } : { path: signed.path };
}
