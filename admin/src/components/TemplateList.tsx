import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { templateMediaUrl } from '@/lib/storage';
import { TemplateSortable, type TemplateRow } from './TemplateSortable';

/** Shared by /templates (song videos) and /photo-templates (images). One category at a time keeps the query small. */
export async function TemplateList({
  type, basePath, cat,
}: { type: 'song_video' | 'image'; basePath: string; cat?: string }) {
  const isImage = type === 'image';
  const { data: cats, error: ce } = await db()
    .from('categories').select('id,name,emoji,slug').eq('output_type', type).order('sort_order');
  if (ce) throw new Error(ce.message);
  const categories = cats ?? [];
  const selected = categories.find((c) => c.slug === cat) ?? categories[0];

  let rows: TemplateRow[] = [];
  if (selected) {
    const { data, error } = await db()
      .from('templates')
      .select('id,name,orientation,photos_min,photos_max,is_active,trending,made_count,thumb_path,song_mode,status,price_tiers(price_inr)')
      .eq('category_id', selected.id)
      .order('sort_order')
      .limit(200);
    if (error) throw new Error(error.message);
    rows = (data ?? []).map((t) => {
      const tier = t.price_tiers as unknown as { price_inr: number } | null;
      return {
        id: t.id, name: t.name, orientation: t.orientation, photos_min: t.photos_min, photos_max: t.photos_max,
        is_active: t.is_active, trending: t.trending, made_count: t.made_count, song_mode: t.song_mode,
        price: tier?.price_inr ?? 0, thumb: templateMediaUrl(t.thumb_path), status: t.status,
      };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{isImage ? 'Photo templates' : 'Video templates'}</h1>
        <Link href={`/templates/new?type=${type}${selected ? `&cat=${selected.id}` : ''}`} className="btn-primary">+ New template</Link>
      </div>
      <p className="text-sm text-ink-muted">Drag ⠿ to change the order inside a category. This is the order users see in the app.</p>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`${basePath}?cat=${c.slug}`}
            className={c.id === selected?.id ? 'btn-primary' : 'btn-glass'}
          >
            {c.emoji} {c.name}
          </Link>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-ink-muted">No categories yet. <Link className="underline" href="/categories">Create one</Link> first.</p>
        )}
      </div>

      {selected && rows.length === 0 && <p className="text-sm text-ink-muted">No templates in {selected.name} yet.</p>}
      {rows.length > 0 && <TemplateSortable rows={rows} isImage={isImage} />}
    </div>
  );
}
