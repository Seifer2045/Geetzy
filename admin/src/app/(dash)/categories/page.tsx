import { db } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { CategoryForm, type CategoryRow } from '@/components/CategoryForm';
import { CategorySortable } from '@/components/CategorySortable';

export default async function CategoriesPage() {
  const admin = await requireAdmin();
  const { data, error } = await db()
    .from('categories')
    .select('id,slug,name,emoji,color_from,color_to,output_type,is_active')
    .order('sort_order');
  if (error) throw new Error(error.message);
  const cats = (data ?? []) as CategoryRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Categories</h1>
        <p className="text-sm text-ink-muted">
          Drag ⠿ to change the order shown in the app. “Show” off hides it. Video and Photo categories appear in separate sections.
        </p>
      </div>
      <CategorySortable cats={cats} canDelete={admin.role === 'super'} />
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">New category</h2>
        <CategoryForm />
      </section>
    </div>
  );
}
