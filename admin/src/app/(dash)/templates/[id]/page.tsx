import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { templateMediaUrl } from '@/lib/storage';
import { TemplateStudio, type TemplateData } from '@/components/TemplateStudio';
import type { LayoutOption } from '@/components/LayoutPicker';
import type { StudioStatus } from '../actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function EditTemplate({ params, searchParams }: Props) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { data: t } = await db().from('templates').select('*').eq('id', decodeURIComponent(id)).maybeSingle();
  if (!t) notFound();

  const [cats, tiers, layouts] = await Promise.all([
    db().from('categories').select('id,name,emoji').eq('output_type', t.output_type).order('sort_order'),
    db().from('price_tiers').select('id,price_inr').order('price_inr'),
    db().from('layouts').select('id,name,kind,slots,photo_count').order('sort_order'),
  ]);
  const isImage = t.output_type === 'image';
  const studio: StudioStatus = {
    art_status: t.art_status, art_error: t.art_error, preview_status: t.preview_status, preview_error: t.preview_error,
    status: t.status, art_bg_url: templateMediaUrl(t.art_bg_path), preview_url: t.preview_url,
    preview_type: isImage ? 'image' : 'video',
    movie_status: t.movie_status, movie_error: t.movie_error,
    movie_json: t.movie_json ? JSON.stringify(t.movie_json, null, 2) : '',
  };

  return (
    <div className="space-y-4">
      <Link href={isImage ? '/photo-templates' : '/templates'} className="text-sm text-ink-muted hover:text-ink">← Back</Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t.name}</h1>
        <p className="font-mono text-xs text-ink-faint">{t.id} · {t.made_count} made · {t.status}</p>
        {(await searchParams).created && (
          <p className="mt-1 text-sm text-ok">Draft created ✓ — the background is being built (free). Press “Generate preview” below when it is ready, then publish.</p>
        )}
      </div>
      <TemplateStudio
        t={{ ...(t as TemplateData), movie_json: t.movie_json ? JSON.stringify(t.movie_json, null, 2) : '' }}
        categories={cats.data ?? []}
        tiers={tiers.data ?? []}
        layouts={(layouts.data ?? []) as LayoutOption[]}
        isImage={isImage}
        canDelete={admin.role === 'super'}
        studio={studio}
        songUrl={templateMediaUrl(t.default_song_path)}
        artUrl={templateMediaUrl(t.art_upload_path)}
      />
    </div>
  );
}
