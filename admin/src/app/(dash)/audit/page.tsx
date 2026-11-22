import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { PAGE_SIZE } from '@/lib/pagination';

type Props = { searchParams: Promise<{ before?: string }> };

export default async function AuditPage({ searchParams }: Props) {
  await requireAdmin();
  const before = Number((await searchParams).before);

  let q = db().from('admin_audit_log').select('id,admin_id,action,target_type,target_id,meta,created_at')
    .order('id', { ascending: false }).limit(PAGE_SIZE + 1);
  if (Number.isFinite(before) && before > 0) q = q.lt('id', before);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  // resolve admin emails with one query
  const ids = [...new Set(page.map((r) => r.admin_id).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await db().from('profiles').select('id,email').in('id', ids);
    ps?.forEach((p) => emails.set(p.id, p.email ?? p.id));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Audit log</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">When</th><th className="th">Admin</th><th className="th">Action</th><th className="th">Target</th><th className="th">Details</th></tr></thead>
          <tbody>
            {page.length === 0 && <tr><td className="td" colSpan={5}>Nothing yet.</td></tr>}
            {page.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="td whitespace-nowrap">{dateTime(r.created_at)}</td>
                <td className="td">{(r.admin_id && emails.get(r.admin_id)) || '—'}</td>
                <td className="td font-mono text-xs">{r.action}</td>
                <td className="td text-xs">{r.target_type ? `${r.target_type}:${r.target_id}` : '—'}</td>
                <td className="td max-w-sm break-all font-mono text-[11px] text-ink-muted">
                  {Object.keys(r.meta ?? {}).length ? JSON.stringify(r.meta) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {Number.isFinite(before) && before > 0 && <Link href="/audit" className="btn-glass">← Latest</Link>}
        {hasMore && <Link href={`/audit?before=${page[page.length - 1].id}`} className="btn-glass">Older →</Link>}
      </div>
    </div>
  );
}
