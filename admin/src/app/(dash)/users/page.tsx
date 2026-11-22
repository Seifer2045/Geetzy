import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { PAGE_SIZE, afterCursor, decodeCursor, encodeCursor, safeSearch } from '@/lib/pagination';

type Props = { searchParams: Promise<{ q?: string; filter?: string; cursor?: string }> };

export default async function UsersPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const q = safeSearch(sp.q);
  const filter = sp.filter === 'credits' || sp.filter === 'blocked' ? sp.filter : '';
  const cursor = decodeCursor(sp.cursor);

  let query = db()
    .from('profiles')
    .select('id,email,full_name,phone,created_at,free_credits,unlimited_until,blocked_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (filter === 'credits') query = query.or(`free_credits.gt.0,unlimited_until.gt.${new Date().toISOString()}`);
  if (filter === 'blocked') query = query.not('blocked_at', 'is', null);
  if (cursor) query = query.or(afterCursor(cursor));

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];

  const base = new URLSearchParams();
  if (q) base.set('q', q);
  if (filter) base.set('filter', filter);
  const nextParams = new URLSearchParams(base);
  if (hasMore && last) nextParams.set('cursor', encodeCursor({ t: last.created_at, id: last.id }));

  const now = Date.now();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>

      <form className="flex flex-wrap gap-2" action="/users">
        <input name="q" defaultValue={q} placeholder="Search email, name or phone" className="input max-w-sm" />
        <select name="filter" defaultValue={filter} className="input w-auto">
          <option value="">All users</option>
          <option value="credits">Has free credits</option>
          <option value="blocked">Blocked</option>
        </select>
        <button className="btn-primary">Search</button>
        {(q || filter || cursor) && <Link href="/users" className="btn-glass">Reset</Link>}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">User</th><th className="th">Phone</th><th className="th">Joined</th>
              <th className="th">Credits</th><th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {page.length === 0 && <tr><td className="td" colSpan={5}>No users found.</td></tr>}
            {page.map((u) => {
              const unlimited = u.unlimited_until && new Date(u.unlimited_until).getTime() > now;
              return (
                <tr key={u.id} className="border-t border-line hover:bg-white/[0.03]">
                  <td className="td">
                    <Link href={`/users/${u.id}`} className="font-semibold text-ink hover:underline">
                      {u.full_name || '—'}
                    </Link>
                    <div className="text-xs text-ink-muted">{u.email ?? '—'}</div>
                  </td>
                  <td className="td">{u.phone ?? '—'}</td>
                  <td className="td whitespace-nowrap">{dateTime(u.created_at)}</td>
                  <td className="td">
                    {unlimited ? <span className="pill text-gold">Unlimited</span> : u.free_credits > 0 ? u.free_credits : '—'}
                  </td>
                  <td className="td">
                    {u.blocked_at ? <span className="pill border-danger/40 text-danger">Blocked</span> : <span className="pill text-ok">Active</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        {cursor && <Link href={`/users?${base}`} className="btn-glass">← First page</Link>}
        {hasMore && <Link href={`/users?${nextParams}`} className="btn-glass">Next →</Link>}
      </div>
    </div>
  );
}
