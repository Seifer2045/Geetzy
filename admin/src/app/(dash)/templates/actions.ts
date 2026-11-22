'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin, audit } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { templateMediaUrl } from '@/lib/storage';
import { nearestTier } from '@/lib/pricing';
import { validateMovieJson } from '@/lib/backend';

export type TplState = { ok?: boolean; error?: string; message?: string };

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colours must look like #FF4D8D');
const uploadPath = z.string().max(200).regex(/^templates\/[A-Za-z0-9_\-./]+$/, 'Bad file path').refine((p) => !p.includes('..'), 'Bad file path');

const schema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, 'Name is required').max(60),
    category_id: z.string().uuid('Pick a category'),
    description: z.string().trim().max(300),
    tags: z.string().max(200),
    style: z.enum(['bollywood', 'retro', 'genz']),
    layout_id: z.string().max(40).optional(),
    video_prompt: z.string().trim().max(300),
    movie_prompt: z.string().trim().max(1500),
    movie_json: z.string().max(25000),
    song_prompt: z.string().trim().max(1500),
    song_instrumental: z.boolean(),
    default_song_path: uploadPath.optional(),
    default_song_start_sec: z.coerce.number().min(0).max(3600),
    art_upload_path: uploadPath.optional(),
    photos_min: z.coerce.number().int().min(1).max(10),
    photos_max: z.coerce.number().int().min(1).max(10),
    song_mode: z.enum(['ai', 'upload', 'both', 'none', 'fixed']),
    duration_sec: z.coerce.number().int().min(5).max(60),
    price_tier_id: z.string().min(1, 'Pick a price'),
    custom_price_inr: z.coerce.number().int().min(1, 'Custom price must be at least ₹1').max(9999).optional(),
    original_price_inr: z.coerce.number().int().min(1).max(100000).optional(),
    color_from: hex,
    color_to: hex,
    render_config: z.string().max(2000),
    trending: z.boolean(),
    is_active: z.boolean(),
    intent: z.enum(['save', 'preview']),
  })
  .refine((v) => v.photos_min <= v.photos_max, { message: 'Min photos cannot be more than max photos', path: ['photos_min'] })
  .refine((v) => v.song_mode !== 'fixed' || !!v.default_song_path, { message: 'Upload the template song first (song type "Template song").', path: ['default_song_path'] });

const opt = (v: FormDataEntryValue | null) => (v === null || v === '' ? undefined : v);

export async function saveTemplate(_prev: TplState, form: FormData): Promise<TplState> {
  const admin = await assertAdmin();
  const parsed = schema.safeParse({
    id: opt(form.get('id')),
    name: form.get('name'),
    category_id: form.get('category_id'),
    description: form.get('description') ?? '',
    tags: form.get('tags') ?? '',
    style: form.get('style'),
    layout_id: opt(form.get('layout_id')),
    video_prompt: form.get('video_prompt') ?? '',
    movie_prompt: form.get('movie_prompt') ?? '',
    movie_json: form.get('movie_json') ?? '',
    song_prompt: form.get('song_prompt') ?? '',
    song_instrumental: form.get('song_instrumental') === 'on',
    default_song_path: opt(form.get('default_song_path')),
    default_song_start_sec: form.get('default_song_start_sec') || 0,
    art_upload_path: opt(form.get('art_upload_path')),
    photos_min: form.get('photos_min') ?? 3,
    photos_max: form.get('photos_max') ?? 5,
    song_mode: form.get('song_mode') ?? 'none',
    duration_sec: form.get('duration_sec') ?? 15,
    price_tier_id: form.get('price_tier_id'),
    custom_price_inr: opt(form.get('custom_price_inr')),
    original_price_inr: opt(form.get('original_price_inr')),
    color_from: form.get('color_from'),
    color_to: form.get('color_to'),
    render_config: form.get('render_config') || '{}',
    trending: form.get('trending') === 'on',
    is_active: form.get('is_active') === 'on',
    intent: form.get('intent') === 'preview' ? 'preview' : 'save',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;

  let renderConfig: Record<string, unknown>;
  try {
    const j = JSON.parse(v.render_config);
    if (typeof j !== 'object' || j === null || Array.isArray(j)) throw new Error();
    renderConfig = j;
  } catch {
    return { error: 'Advanced video settings must be a JSON object, e.g. {"font":"Poppins"}.' };
  }

  // Movie template (written by Grok or by hand): must pass the backend's rules before it is saved.
  let movieJson: unknown = null;
  const movieText = v.movie_json.trim();
  if (movieText) {
    try {
      movieJson = JSON.parse(movieText);
    } catch {
      return { error: 'The video design JSON is not valid JSON. Use Validate to see where.' };
    }
    const problems = await validateMovieJson(movieJson, v.photos_min, v.photos_max);
    if (problems.length) return { error: `Video design: ${problems.slice(0, 3).join(' ')}` };
  }

  const supabase = db();
  const { data: cat } = await supabase.from('categories').select('slug,output_type').eq('id', v.category_id).maybeSingle();
  if (!cat) return { error: 'Category not found.' };
  const isImage = cat.output_type === 'image';

  // new templates must have a layout; older ones may stay on the classic slideshow (no layout)
  let layout: { id: string; kind: string; photo_count: number } | null = null;
  if (v.layout_id) {
    const { data } = await supabase.from('layouts').select('id,kind,photo_count').eq('id', v.layout_id).maybeSingle();
    if (!data) return { error: 'Layout not found.' };
    if ((data.kind === 'image') !== isImage) return { error: 'That layout does not fit this kind of template.' };
    layout = data;
  } else if (!v.id) {
    return { error: 'Pick a layout.' };
  }

  // Custom price: the app shows it, Google Play charges the nearest tier. No custom price = the chosen tier.
  const { data: tiers } = await supabase.from('price_tiers').select('id,price_inr').eq('active', true);
  if (!tiers?.length) return { error: 'No price tiers found.' };
  const tier = v.custom_price_inr ? nearestTier(v.custom_price_inr, tiers) : tiers.find((t) => t.id === v.price_tier_id);
  if (!tier) return { error: 'Pick a price.' };

  const row: Record<string, unknown> = {
    name: v.name,
    category_id: v.category_id,
    description: v.description,
    tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
    style: v.style,
    layout_id: layout?.id ?? null,
    video_prompt: isImage ? '' : v.video_prompt,
    movie_prompt: isImage ? '' : v.movie_prompt,
    song_prompt: isImage ? '' : v.song_prompt,
    song_instrumental: !isImage && v.song_instrumental,
    song_provider: null, // ElevenLabs is the only maker; null = server default
    default_song_path: isImage || v.song_mode === 'none' ? null : v.default_song_path ?? null,
    default_song_start_sec: v.default_song_start_sec,
    art_upload_path: v.art_upload_path ?? null,
    // photo templates: the layout decides how many photos the user adds
    photos_min: isImage && layout ? layout.photo_count : v.photos_min,
    photos_max: isImage && layout ? layout.photo_count : v.photos_max,
    song_mode: isImage ? 'none' : v.song_mode,
    duration_sec: v.duration_sec,
    price_tier_id: tier.id,
    custom_price_inr: v.custom_price_inr ?? null,
    original_price_inr: v.original_price_inr ?? null,
    color_from: v.color_from,
    color_to: v.color_to,
    render_config: renderConfig,
    orientation: 'vertical', // everything is 9:16
    trending: v.trending,
    is_active: v.is_active,
    auto_preview: v.intent === 'preview',
  };

  const revalidate = (id: string) => {
    revalidatePath('/templates'); revalidatePath('/photo-templates'); revalidatePath(`/templates/${id}`);
  };

  if (v.id) {
    const { data: existing } = await supabase.from('templates')
      .select('output_type,layout_id,art_upload_path,color_from,color_to,art_status,preview_status,duration_sec,default_song_path,default_song_start_sec,song_prompt,video_prompt,photos_max,song_mode,style,movie_json,movie_status')
      .eq('id', v.id).maybeSingle();
    if (!existing) return { error: 'Template not found.' };
    if (existing.output_type !== cat.output_type) return { error: 'You cannot move a template to a category of the other type.' };

    // The art (free, Pillow) depends on layout + uploaded background (or the colours when there is none).
    const artChanged = existing.layout_id !== row.layout_id || existing.art_upload_path !== row.art_upload_path
      || (!row.art_upload_path && (existing.color_from !== v.color_from || existing.color_to !== v.color_to));
    // The preview video depends on all of these: a stale one must not be published.
    const previewKeys = ['duration_sec', 'default_song_path', 'default_song_start_sec', 'song_prompt', 'video_prompt', 'photos_max', 'song_mode', 'style'] as const;
    const previewStale = artChanged || previewKeys.some((k) => existing[k] !== row[k]);
    const busyNow = ['queued', 'running'].includes(existing.art_status) || ['queued', 'running'].includes(existing.preview_status);

    // Hand-edited or cleared design. Grok's own result is saved by the backend job, so an unchanged JSON is left alone.
    const newMovie = isImage ? null : movieJson;
    const movieChanged = JSON.stringify(newMovie) !== JSON.stringify(existing.movie_json ?? null);
    if (movieChanged) {
      Object.assign(row, newMovie
        ? { movie_json: newMovie, movie_source: 'manual', movie_status: 'ready', movie_error: null, movie_hash: null }
        : { movie_json: null, movie_source: null, movie_status: 'none', movie_error: null, movie_hash: null });
    }
    let note = '';
    if (artChanged) {
      Object.assign(row, {
        art_status: busyNow ? existing.art_status : 'queued', art_error: null, preview_status: 'none', preview_error: null,
        preview_url: null, preview_video_path: null, status: 'draft',
      });
      note = ' Art is being rebuilt (free); make the preview again, then publish.';
    } else if ((previewStale || movieChanged) && existing.preview_status !== 'none') {
      Object.assign(row, { preview_status: busyNow ? existing.preview_status : 'none', status: 'draft' });
      note = ' The preview is out of date: make it again, then publish.';
    }
    const { error } = await supabase.from('templates').update(row).eq('id', v.id);
    if (error) return { error: error.message };
    // "Save & generate preview" with art already built: queue the preview now (the DB trigger starts it).
    if (v.intent === 'preview' && !artChanged && !busyNow && existing.art_status === 'ready') {
      const { error: e2 } = await supabase.from('templates').update({ preview_status: 'queued', preview_error: null, auto_preview: false }).eq('id', v.id);
      if (e2) return { error: e2.message };
      note = ' Preview is rendering (about a minute).';
    }
    await audit(admin.id, 'template.update', { type: 'template', id: v.id }, { name: v.name });
    revalidate(v.id);
    return { ok: true, message: `Saved.${note}` };
  }

  // new template: readable id like TPL-BI-4821 (retry on the rare clash). Starts as a Draft.
  const prefix = cat.slug.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const { data: last } = await supabase.from('templates').select('sort_order').eq('category_id', v.category_id)
    .order('sort_order', { ascending: false }).limit(1);
  const sort_order = (last?.[0]?.sort_order ?? 0) + 10;
  for (let i = 0; i < 5; i++) {
    const id = `TPL-${prefix}-${(randomBytes(2).readUInt16BE() % 9000) + 1000}`;
    const movie = isImage || !movieJson ? {} : { movie_json: movieJson, movie_source: 'manual', movie_status: 'ready' };
    const { error } = await supabase.from('templates').insert({ ...row, ...movie, id, sort_order, status: 'draft' });
    if (!error) {
      // The DB trigger only reacts to updates, so queue the free art build right after the insert.
      await supabase.from('templates').update({ art_status: 'queued' }).eq('id', id);
      await audit(admin.id, 'template.create', { type: 'template', id }, { name: v.name });
      revalidatePath('/templates'); revalidatePath('/photo-templates');
      redirect(`/templates/${id}?created=1`);
    }
    if (error.code !== '23505') return { error: error.message };
  }
  return { error: 'Could not create a unique template id, try again.' };
}

const UPLOADS = {
  art: { exts: ['jpg', 'jpeg', 'png', 'webp'], mimes: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8 * 1024 * 1024 },
  song: { exts: ['mp3', 'm4a', 'wav', 'aac'], mimes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/aac'], maxBytes: 15 * 1024 * 1024 },
} as const;

/** One-time signed URL so the browser uploads big files straight to Storage (not through a server action). */
export async function createUploadUrl(
  kind: 'art' | 'song', ext: string, contentType: string, size: number,
): Promise<{ path: string; token: string } | { error: string }> {
  await assertAdmin();
  const rule = UPLOADS[kind];
  if (!rule) return { error: 'Bad upload type.' };
  const e = ext.toLowerCase();
  if (!(rule.exts as readonly string[]).includes(e) || !(rule.mimes as readonly string[]).includes(contentType)) {
    return { error: `Use one of: ${rule.exts.join(', ')}.` };
  }
  if (size > rule.maxBytes) return { error: `File is too big (max ${rule.maxBytes / 1024 / 1024} MB).` };
  const path = `templates/_incoming/${kind}-${randomUUID()}.${e}`;
  const { data, error } = await db().storage.from('template-media').createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? 'Could not start the upload.' };
  return { path, token: data.token };
}

// ───────────────────────────────────────────────────────────── studio jobs (the DB trigger starts the backend)
export async function generateArt(id: string): Promise<TplState> {
  const admin = await assertAdmin();
  const { data: t } = await db().from('templates').select('layout_id,art_status').eq('id', id).maybeSingle();
  if (!t) return { error: 'Template not found.' };
  if (!t.layout_id) return { error: 'Pick a layout and save first.' };
  // only start when nothing is running (compare-and-set: a double click cannot start two jobs)
  const { data, error } = await db().from('templates')
    .update({ art_status: 'queued', art_error: null }).eq('id', id).in('art_status', ['none', 'ready', 'error']).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Art is already being built.' };
  await audit(admin.id, 'template.generate_art', { type: 'template', id });
  return { ok: true };
}

export async function generatePreview(id: string): Promise<TplState> {
  const admin = await assertAdmin();
  const { data: t } = await db().from('templates').select('art_status').eq('id', id).maybeSingle();
  if (!t) return { error: 'Template not found.' };
  if (t.art_status !== 'ready') return { error: 'Generate the art first.' };
  const { data, error } = await db().from('templates')
    .update({ preview_status: 'queued', preview_error: null }).eq('id', id).in('preview_status', ['none', 'ready', 'error']).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'A preview is already being made.' };
  await audit(admin.id, 'template.generate_preview', { type: 'template', id });
  return { ok: true };
}

export async function setPublished(id: string, publish: boolean): Promise<TplState> {
  const admin = await assertAdmin();
  const { error } = await db().from('templates').update({ status: publish ? 'published' : 'draft' }).eq('id', id);
  if (error) {
    return { error: error.message.includes('template_not_ready') ? 'Generate the art and the preview first.' : error.message };
  }
  await audit(admin.id, publish ? 'template.publish' : 'template.unpublish', { type: 'template', id });
  revalidatePath('/templates'); revalidatePath('/photo-templates'); revalidatePath(`/templates/${id}`);
  return { ok: true };
}

export type StudioStatus = {
  art_status: string; art_error: string | null; preview_status: string; preview_error: string | null;
  status: string; art_bg_url: string | null; preview_url: string | null; preview_type: 'video' | 'image';
  movie_status: string; movie_error: string | null; movie_json: string;
};

/** One tiny row read, polled every few seconds while a job runs. */
export async function getStudioStatus(id: string): Promise<StudioStatus | null> {
  await assertAdmin();
  const { data } = await db().from('templates')
    .select('art_status,art_error,preview_status,preview_error,status,art_bg_path,preview_url,output_type,movie_status,movie_error,movie_json').eq('id', id).maybeSingle();
  if (!data) return null;
  return {
    art_status: data.art_status, art_error: data.art_error, preview_status: data.preview_status,
    preview_error: data.preview_error, status: data.status, art_bg_url: templateMediaUrl(data.art_bg_path),
    preview_url: data.preview_url, preview_type: data.output_type === 'image' ? 'image' : 'video',
    movie_status: data.movie_status, movie_error: data.movie_error,
    movie_json: data.movie_json ? JSON.stringify(data.movie_json, null, 2) : '',
  };
}

/** Generate with Grok: saves the brief, then the DB trigger starts the backend job (xAI is called there, once). */
export async function generateMovie(id: string, prompt: string, force: boolean): Promise<TplState> {
  const admin = await assertAdmin();
  const brief = prompt.trim();
  if (brief.length < 10) return { error: 'Describe the video in a sentence or two first.' };
  if (brief.length > 1500) return { error: 'The brief is too long (max 1500 characters).' };
  const { data: t } = await db().from('templates').select('output_type').eq('id', id).maybeSingle();
  if (!t) return { error: 'Template not found. Save it first.' };
  if (t.output_type === 'image') return { error: 'Photo templates do not use a video design.' };
  const fields: Record<string, unknown> = { movie_prompt: brief, movie_status: 'queued', movie_error: null };
  if (force) fields.movie_hash = null; // same brief again = no xAI call, unless the admin asks for a new design
  const { data, error } = await db().from('templates').update(fields).eq('id', id).in('movie_status', ['none', 'ready', 'error']).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Grok is already working on this template.' };
  await audit(admin.id, 'template.generate_movie', { type: 'template', id }, { force });
  return { ok: true };
}

/** The Validate button: same rules the backend uses before it renders anything. */
export async function validateMovie(jsonText: string, photosMin: number, photosMax: number): Promise<{ errors: string[] }> {
  await assertAdmin();
  if (!jsonText.trim()) return { errors: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { errors: [`Not valid JSON: ${e instanceof Error ? e.message : 'check the commas and quotes'}`] };
  }
  return { errors: await validateMovieJson(parsed, Math.max(1, photosMin || 1), Math.min(10, Math.max(1, photosMax || 1))) };
}

export async function reorderTemplates(ids: string[]): Promise<TplState> {
  const admin = await assertAdmin();
  if (!z.array(z.string().max(40)).max(300).safeParse(ids).success) return { error: 'Bad order.' };
  const { error } = await db().rpc('admin_reorder', { p_table: 'templates', p_ids: ids });
  if (error) return { error: error.message };
  await audit(admin.id, 'template.reorder', { type: 'template' }, { count: ids.length });
  revalidatePath('/templates'); revalidatePath('/photo-templates');
  return { ok: true };
}

export async function setTemplateActive(_prev: TplState, form: FormData): Promise<TplState> {
  const admin = await assertAdmin();
  const id = String(form.get('id') ?? '');
  const active = form.get('active') === '1';
  const { error } = await db().from('templates').update({ is_active: active }).eq('id', id);
  if (error) return { error: error.message };
  await audit(admin.id, active ? 'template.show' : 'template.hide', { type: 'template', id });
  revalidatePath('/templates'); revalidatePath('/photo-templates');
  return { ok: true };
}

export async function deleteTemplate(_prev: TplState, form: FormData): Promise<TplState> {
  const admin = await assertAdmin('super');
  const id = String(form.get('id') ?? '');
  const { count } = await db().from('gifts').select('id', { count: 'exact', head: true }).eq('template_id', id);
  if (count) return { error: `${count} video(s) were made with this template, so it cannot be deleted. Hide it instead.` };
  const { error } = await db().from('templates').delete().eq('id', id);
  if (error) return { error: error.message };
  await audit(admin.id, 'template.delete', { type: 'template', id });
  revalidatePath('/templates'); revalidatePath('/photo-templates');
  redirect('/templates');
}
