'use client';

import Link from 'next/link';
import { SortableList } from './SortableList';
import { reorderTemplates } from '@/app/(dash)/templates/actions';

export type TemplateRow = {
  id: string; name: string; orientation: string; photos_min: number; photos_max: number;
  is_active: boolean; trending: boolean; made_count: number; price: number; thumb: string | null;
  song_mode: string; status: string;
};

export function TemplateSortable({ rows, isImage }: { rows: TemplateRow[]; isImage: boolean }) {
  return (
    <SortableList
      onSave={reorderTemplates}
      items={rows.map((t) => ({
        id: t.id,
        node: (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.thumb ? <img src={t.thumb} alt="" loading="lazy" className="h-14 w-10 rounded-lg object-cover" />
              : <div className="h-14 w-10 rounded-lg bg-brand/40" />}
            <div className="min-w-0 flex-1">
              <Link href={`/templates/${t.id}`} className="block truncate font-semibold hover:underline">{t.name}</Link>
              <p className="text-xs text-ink-muted">
                {t.id} · ₹{t.price} · 9:16 · {t.photos_min === t.photos_max ? t.photos_min : `${t.photos_min}-${t.photos_max}`} photos
                {!isImage && ` · song: ${t.song_mode}`} · {t.made_count} made
              </p>
            </div>
            {t.trending && <span className="pill text-gold">Trending</span>}
            {t.status === 'draft'
              ? <span className="pill text-gold">Draft</span>
              : <span className={`pill ${t.is_active ? 'text-ok' : 'text-ink-faint'}`}>{t.is_active ? 'Live' : 'Hidden'}</span>}
            <Link href={`/templates/${t.id}`} className="btn-glass px-3 py-1 text-xs">Edit</Link>
          </div>
        ),
      }))}
    />
  );
}
