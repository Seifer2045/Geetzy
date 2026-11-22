'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin, audit } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';

export type ActionState = { ok?: boolean; error?: string; message?: string };

const uuid = z.string().uuid();

const grantSchema = z.object({
  userId: uuid,
  kind: z.enum(['credits', 'unlimited']),
  amount: z.coerce.number().int().min(1).max(100000),
  note: z.string().max(200).optional(),
});

export async function grantAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await assertAdmin(); // support + super may grant
  const parsed = grantSchema.safeParse({
    userId: form.get('userId'),
    kind: form.get('kind'),
    amount: form.get('amount'),
    note: form.get('note') || undefined,
  });
  if (!parsed.success) return { error: 'Enter a whole number between 1 and 100000.' };
  const { userId, kind, amount, note } = parsed.data;

  const { error } = await db().rpc('admin_grant', {
    p_user_id: userId, p_admin_id: admin.id, p_kind: kind, p_amount: amount, p_note: note ?? '',
  });
  if (error) return { error: error.message };

  await audit(admin.id, 'user.grant', { type: 'user', id: userId }, { kind, amount, note });
  revalidatePath(`/users/${userId}`);
  return { ok: true, message: kind === 'credits' ? `Added ${amount} free video(s).` : `Unlimited extended by ${amount} day(s).` };
}

export async function resetGrantAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await assertAdmin('super');
  const userId = uuid.safeParse(form.get('userId'));
  if (!userId.success) return { error: 'Bad user id.' };
  const { error } = await db().from('profiles').update({ free_credits: 0, unlimited_until: null }).eq('id', userId.data);
  if (error) return { error: error.message };
  await audit(admin.id, 'user.clear_credits', { type: 'user', id: userId.data });
  revalidatePath(`/users/${userId.data}`);
  return { ok: true, message: 'Credits cleared.' };
}

export async function blockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const userId = uuid.safeParse(form.get('userId'));
  if (!userId.success) return { error: 'Bad user id.' };
  const block = form.get('block') === '1';
  const { error } = await db()
    .from('profiles')
    .update({ blocked_at: block ? new Date().toISOString() : null })
    .eq('id', userId.data);
  if (error) return { error: error.message };
  await audit(admin.id, block ? 'user.block' : 'user.unblock', { type: 'user', id: userId.data });
  revalidatePath(`/users/${userId.data}`);
  return { ok: true, message: block ? 'User blocked.' : 'User unblocked.' };
}

/** Recursively collect every file path under a prefix in a Storage bucket. */
async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [prefix];
  while (stack.length) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await db().storage.from(bucket).list(dir, { limit: 1000, offset });
      if (error) throw new Error(`Storage list failed (${bucket}/${dir}): ${error.message}`);
      if (!data || data.length === 0) break;
      for (const item of data) {
        // folders have no id/metadata
        if (item.id === null) stack.push(`${dir}/${item.name}`);
        else out.push(`${dir}/${item.name}`);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  return out;
}

async function removeUserFiles(userId: string) {
  for (const bucket of ['gift-uploads', 'gift-media']) {
    const files = await listAll(bucket, userId);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await db().storage.from(bucket).remove(files.slice(i, i + 100));
      if (error) throw new Error(`Storage delete failed (${bucket}): ${error.message}`);
    }
  }
}

/** PERMANENT. Files first, then the auth user (the DB cascades profile → gifts → photos/songs/renders/payments/ai logs). */
export async function deleteUserAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await assertAdmin('super');
  const userId = uuid.safeParse(form.get('userId'));
  if (!userId.success) return { error: 'Bad user id.' };
  const id = userId.data;

  if (id === admin.id) return { error: 'You cannot delete your own account.' };
  const { data: isAdmin } = await db().from('admins').select('user_id').eq('user_id', id).maybeSingle();
  if (isAdmin) return { error: 'This user is an admin. Remove admin access first.' };

  const { data: profile } = await db().from('profiles').select('email').eq('id', id).maybeSingle();
  if (!profile) return { error: 'User not found.' };
  if (String(form.get('confirm') ?? '').trim().toLowerCase() !== (profile.email ?? id).toLowerCase()) {
    return { error: 'Confirmation text does not match.' };
  }

  try {
    await removeUserFiles(id);
    const { error } = await db().auth.admin.deleteUser(id);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Delete failed.' };
  }

  // Only the id is kept (no personal data).
  await audit(admin.id, 'user.delete', { type: 'user', id });
  revalidatePath('/users');
  redirect('/users?deleted=1');
}
