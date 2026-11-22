'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertAdmin, audit } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';

export type CatState = { ok?: boolean; error?: string };

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #FF4D8D');

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug: a-z, 0-9 and -').max(40),
  emoji: z.string().trim().max(8).optional(),
  color_from: hex,
  color_to: hex,
  output_type: z.enum(['song_video', 'image']),
  is_active: z.boolean(),
});

export async function saveCategory(_prev: CatState, form: FormData): Promise<CatState> {
  const admin = await assertAdmin();
  const parsed = schema.safeParse({
    id: form.get('id') || undefined,
    name: form.get('name'),
    slug: form.get('slug'),
    emoji: form.get('emoji') || undefined,
    color_from: form.get('color_from'),
    color_to: form.get('color_to'),
    output_type: form.get('output_type'),
    is_active: form.get('is_active') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { id, ...fields } = parsed.data;

  if (id) {
    // slug and output type are fixed after creation (templates + the app depend on them)
    const { slug: _s, output_type: _o, ...editable } = fields;
    const { error } = await db().from('categories').update(editable).eq('id', id);
    if (error) return { error: error.message };
    await audit(admin.id, 'category.update', { type: 'category', id }, editable);
  } else {
    const { data: last } = await db().from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const sort_order = (last?.[0]?.sort_order ?? 0) + 10;
    const { data, error } = await db().from('categories').insert({ ...fields, sort_order }).select('id').single();
    if (error) return { error: error.code === '23505' ? 'That slug is already used.' : error.message };
    await audit(admin.id, 'category.create', { type: 'category', id: data.id }, fields);
  }
  revalidatePath('/categories');
  return { ok: true };
}

export async function reorderCategories(ids: string[]): Promise<CatState> {
  const admin = await assertAdmin();
  if (!z.array(z.string().uuid()).max(200).safeParse(ids).success) return { error: 'Bad order.' };
  const { error } = await db().rpc('admin_reorder', { p_table: 'categories', p_ids: ids });
  if (error) return { error: error.message };
  await audit(admin.id, 'category.reorder', { type: 'category' }, { count: ids.length });
  revalidatePath('/categories');
  return { ok: true };
}

export async function deleteCategory(_prev: CatState, form: FormData): Promise<CatState> {
  const admin = await assertAdmin('super');
  const id = z.string().uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Bad id.' };
  const { count } = await db().from('templates').select('id', { count: 'exact', head: true }).eq('category_id', id.data);
  if (count) return { error: `Move or delete its ${count} template(s) first, or just hide the category.` };
  const { error } = await db().from('categories').delete().eq('id', id.data);
  if (error) return { error: error.message };
  await audit(admin.id, 'category.delete', { type: 'category', id: id.data });
  revalidatePath('/categories');
  return { ok: true };
}
