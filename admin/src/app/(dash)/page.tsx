import { unstable_cache } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { dateTime, inr, num, usd } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { BarChart } from '@/components/BarChart';

type Overview = {
  users_total: number; users_7d: number; gifts_total: number; gifts_today: number; gifts_7d: number;
  gifts_30d: number; paid_total: number; failed_total: number; revenue_total: number; revenue_30d: number;
  ai_cost_30d_usd: number; credit_holders: number; in_progress: number;
};

// 3 tiny queries, cached 60 s → the Overview never hits the DB more than once a minute.
const load = unstable_cache(
  async () => {
    const supabase = db();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const [ov, series, failures] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.from('daily_stats').select('day,gifts,new_users,revenue_inr').gte('day', since).order('day'),
      supabase.from('gifts').select('id,code,error,updated_at,template_id').eq('status', 'failed')
        .order('updated_at', { ascending: false }).limit(5),
    ]);
    return {
      ov: (ov.data ?? {}) as Overview,
      series: series.data ?? [],
      failures: failures.data ?? [],
    };
  },
  ['overview'],
  { revalidate: 60 },
);

export default async function Overview() {
  const { ov, series, failures } = await load();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={num(ov.users_total)} hint={`+${num(ov.users_7d)} this week`} />
        <StatCard label="Active free credits" value={num(ov.credit_holders)} hint="users with credits / unlimited" />
        <StatCard label="Videos made" value={num(ov.gifts_total)} hint={`${num(ov.gifts_today)} today · ${num(ov.gifts_7d)} in 7d`} />
        <StatCard label="In progress now" value={num(ov.in_progress)} hint={`${num(ov.failed_total)} failed overall`} />
        <StatCard label="Paid videos" value={num(ov.paid_total)} />
        <StatCard label="Revenue (all time)" value={inr(ov.revenue_total)} hint={`${inr(ov.revenue_30d)} in 30d`} accent />
        <StatCard label="Videos (30 days)" value={num(ov.gifts_30d)} />
        <StatCard label="AI cost (30 days, est.)" value={usd(ov.ai_cost_30d_usd)} />
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">Videos per day (last 30 days)</h2>
        <BarChart data={series.map((s) => ({ label: s.day as string, value: s.gifts as number }))} />
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-4 pt-4 text-sm font-semibold text-ink-2">Latest failures</h2>
        <table className="w-full">
          <thead><tr><th className="th">Gift</th><th className="th">Template</th><th className="th">Error</th><th className="th">When</th></tr></thead>
          <tbody>
            {failures.length === 0 && <tr><td className="td" colSpan={4}>No failures 🎉</td></tr>}
            {failures.map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="td font-mono">{f.code}</td>
                <td className="td">{f.template_id}</td>
                <td className="td max-w-md truncate text-danger">{f.error ?? '—'}</td>
                <td className="td whitespace-nowrap">{dateTime(f.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
