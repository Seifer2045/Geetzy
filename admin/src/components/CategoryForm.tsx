'use client';

import { useActionState, useRef } from 'react';
import { saveCategory, deleteCategory, type CatState } from '@/app/(dash)/categories/actions';

export type CategoryRow = {
  id: string; slug: string; name: string; emoji: string | null; color_from: string; color_to: string;
  output_type: 'song_video' | 'image'; is_active: boolean;
};

export function CategoryForm({ cat, canDelete }: { cat?: CategoryRow; canDelete?: boolean }) {
  const [state, action, pending] = useActionState<CatState, FormData>(saveCategory, {});
  const ref = useRef<HTMLFormElement>(null);
  // clear the form after a successful create
  if (state.ok && !cat && ref.current) ref.current.reset();

  return (
    <div className="space-y-2">
      <form ref={ref} action={action} className="grid grid-cols-2 items-end gap-2 md:grid-cols-12">
        {cat && <input type="hidden" name="id" value={cat.id} />}
        <div className="md:col-span-2"><label className="label">Emoji</label>
          <input name="emoji" defaultValue={cat?.emoji ?? ''} className="input" maxLength={8} /></div>
        <div className="md:col-span-3"><label className="label">Name</label>
          <input name="name" defaultValue={cat?.name} className="input" required /></div>
        <div className="md:col-span-2"><label className="label">Slug</label>
          <input name="slug" defaultValue={cat?.slug} className="input" required readOnly={!!cat} /></div>
        <div className="md:col-span-2"><label className="label">Type</label>
          {cat ? (
            <><input type="hidden" name="output_type" value={cat.output_type} />
              <div className="input opacity-70">{cat.output_type === 'image' ? 'Photo' : 'Video'}</div></>
          ) : (
            <select name="output_type" className="input" defaultValue="song_video">
              <option value="song_video">Song video</option>
              <option value="image">Photo (image)</option>
            </select>
          )}
        </div>
        <div className="md:col-span-1"><label className="label">From</label>
          <input name="color_from" type="color" defaultValue={cat?.color_from ?? '#FF4D8D'} className="h-10 w-full rounded-lg bg-transparent" /></div>
        <div className="md:col-span-1"><label className="label">To</label>
          <input name="color_to" type="color" defaultValue={cat?.color_to ?? '#C04CF0'} className="h-10 w-full rounded-lg bg-transparent" /></div>
        <label className="flex items-center gap-2 pb-2 text-sm md:col-span-1">
          <input name="is_active" type="checkbox" defaultChecked={cat?.is_active ?? true} /> Show
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-12">
          <button className="btn-primary" disabled={pending}>{cat ? 'Save' : 'Add category'}</button>
        </div>
      </form>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && cat && <p className="text-sm text-ok">Saved ✓</p>}
      {cat && canDelete && <DeleteBtn id={cat.id} />}
    </div>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CatState, FormData>(deleteCategory, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger px-3 py-1 text-xs" disabled={pending}>Delete</button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
