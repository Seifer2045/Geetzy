'use client';

import { SortableList } from './SortableList';
import { CategoryForm, type CategoryRow } from './CategoryForm';
import { reorderCategories } from '@/app/(dash)/categories/actions';

export function CategorySortable({ cats, canDelete }: { cats: CategoryRow[]; canDelete: boolean }) {
  return (
    <SortableList
      onSave={reorderCategories}
      items={cats.map((c) => ({
        id: c.id,
        node: (
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
                style={{ background: `linear-gradient(135deg, ${c.color_from}, ${c.color_to})` }}
              >{c.emoji}</span>
              <span className="font-semibold">{c.name}</span>
              <span className="pill text-ink-muted">{c.output_type === 'image' ? 'Photo' : 'Video'}</span>
              {!c.is_active && <span className="pill text-ink-faint">Hidden</span>}
              <span className="ml-auto text-xs text-ink-muted">Edit ▾</span>
            </summary>
            <div className="pt-3"><CategoryForm cat={c} canDelete={canDelete} /></div>
          </details>
        ),
      }))}
    />
  );
}
