import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { TemplateStudio } from '@/components/TemplateStudio';
import { EMPTY_TEMPLATE } from '@/lib/templateData';
import type { LayoutOption } from '@/components/LayoutPicker';

type Props = { searchParams: Promise<{ type?: string; cat?: string }> };

export default async function NewTemplate({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const type = sp.type === 'image' ? 'image' : 'song_video';
  const [cats, tiers, layouts] = await Promise.all([
    db().from('categories').select('id,name,emoji').eq('output_type', type).order('sort_order'),
    db().from('price_tiers').select('id,price_inr').eq('active', true).order('price_inr'),
    db().from('layouts').select('id,name,kind,slots,photo_count').order('sort_order'),
  ]);
  const isImage = type === 'image';
  return (
    <div className="space-y-4">
      <Link href={isImage ? '/photo-templates' : '/templates'} className="text-sm text-ink-muted hover:text-ink">← Back</Link>
      <h1 className="text-2xl font-extrabold tracking-tight">New {isImage ? 'photo' : 'video'} template</h1>
      <TemplateStudio
        t={{ ...EMPTY_TEMPLATE, category_id: sp.cat ?? '', song_mode: isImage ? 'none' : 'both' }}
        categories={cats.data ?? []}
        tiers={tiers.data ?? []}
        layouts={(layouts.data ?? []) as LayoutOption[]}
        isImage={isImage}
        canDelete={false}
        studio={null}
        songUrl={null}
        artUrl={null}
      />
    </div>
  );
}
