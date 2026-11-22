'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { sessionClient } from '@/lib/supabase/server';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Enter email and password.' };

  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (error || !data.user) {
    // Lengths only (never the password) so a stray space or autofill can be spotted in the logs.
    console.error('admin login failed', { status: error?.status, code: error?.code, message: error?.message, emailLen: email.length, passwordLen: password.length });
    return { error: `Sign-in failed: ${error?.message ?? 'unknown error'}${error?.code ? ` (${error.code})` : ''}. Typed: email ${email.length} chars, password ${password.length} chars.` };
  }

  const { data: admin } = await db().from('admins').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: 'This account is not an admin.' };
  }
  redirect('/');
}

export async function logout() {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
  redirect('/login');
}
