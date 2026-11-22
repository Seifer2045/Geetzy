import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { dateTime, inr, usd } from '@/lib/format';
import { BlockForm, ClearCreditsForm, DeleteForm, GrantForm } from '@/components/UserActions';

type Props = { params: Promise<{ id: string }> };

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-ok', preview_ready: 'text-gold', failed: 'text-danger',
};

export default async function UserDetail({ params }: Props) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = db();
  const [profile, gifts, payments, grants, ai] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('gifts')
      .select('id,code,template_id,status,price_inr,error,created_at,deleted_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('payments')
      .select('id,gift_id,provider,product_id,order_id,amount_inr,status,verified_at,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('credit_grants')
      .select('id,kind,amount,expires_at,note,created_at,admin_id')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('ai_requests').select('kind,est_cost_usd,ok').eq('user_id', id).limit(500),
  ]);
  const p = profile.data;
  if (!p) notFound();

  const aiRows = ai.data ?? [];
  const aiCost = aiRows.reduce((s, r) => s + Number(r.est_cost_usd ?? 0), 0);
  const spent = (payments.data ?? [])
    .filter((x) => x.status === 'verified' && x.provider !== 'credit')
    .reduce((s, x) => s + x.amount_inr, 0);
  const unlimited = p.unlimited_until && new Date(p.unlimited_until).getTime() > Date.now();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/users" className="text-sm text-ink-muted hover:text-ink">← Users</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{p.full_name || p.email || 'User'}</h1>
        <p className="font-mono text-xs text-ink-faint">{p.id}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-2 p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink-2">Profile</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row k="Email" v={p.email} /><Row k="Phone" v={p.phone} />
            <Row k="Joined" v={dateTime(p.created_at)} /><Row k="Age confirmed" v={dateTime(p.age_confirmed_at)} />
            <Row k="Free videos left" v={String(p.free_credits)} />
            <Row k="Unlimited until" v={unlimited ? dateTime(p.unlimited_until) : '—'} />
            <Row k="Total paid" v={inr(spent)} />
            <Row k="Videos made" v={String(gifts.data?.length ?? 0) + (gifts.data?.length === 50 ? '+' : '')} />
            <Row k="AI calls / est. cost" v={`${aiRows.length} / ${usd(aiCost)}`} />
            <Row k="Status" v={p.blocked_at ? `Blocked ${dateTime(p.blocked_at)}` : 'Active'} />
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <BlockForm userId={p.id} blocked={!!p.blocked_at} />
            {admin.role === 'super' && (p.free_credits > 0 || unlimited) && <ClearCreditsForm userId={p.id} />}
          </div>
        </section>
        <GrantForm userId={p.id} />
      </div>

      <Table title="Purchases" empty="No payments." head={['When', 'Gift', 'Provider', 'Amount', 'Status']}>
        {(payments.data ?? []).map((x) => (
          <tr key={x.id} className="border-t border-line">
            <td className="td whitespace-nowrap">{dateTime(x.created_at)}</td>
            <td className="td font-mono text-xs">{x.gift_id.slice(0, 8)}</td>
            <td className="td">{x.provider}{x.product_id ? ` · ${x.product_id}` : ''}</td>
            <td className="td">{inr(x.amount_inr)}</td>
            <td className="td">{x.status}</td>
          </tr>
        ))}
      </Table>

      <Table title="Videos (latest 50)" empty="No videos yet." head={['Code', 'Template', 'Status', 'Price', 'Created', 'Error']}>
        {(gifts.data ?? []).map((g) => (
          <tr key={g.id} className="border-t border-line">
            <td className="td font-mono">{g.code}{g.deleted_at ? ' (deleted)' : ''}</td>
            <td className="td">{g.template_id}</td>
            <td className={`td font-semibold ${STATUS_COLOR[g.status] ?? ''}`}>{g.status}</td>
            <td className="td">{inr(g.price_inr)}</td>
            <td className="td whitespace-nowrap">{dateTime(g.created_at)}</td>
            <td className="td max-w-xs truncate text-danger">{g.error ?? ''}</td>
          </tr>
        ))}
      </Table>

      <Table title="Grant history" empty="No grants." head={['When', 'Type', 'Amount', 'Expires', 'Note']}>
        {(grants.data ?? []).map((g) => (
          <tr key={g.id} className="border-t border-line">
            <td className="td whitespace-nowrap">{dateTime(g.created_at)}</td>
            <td className="td">{g.kind === 'credits' ? 'Free videos' : 'Unlimited'}</td>
            <td className="td">{g.amount}{g.kind === 'unlimited' ? ' days' : ''}</td>
            <td className="td">{dateTime(g.expires_at)}</td>
            <td className="td">{g.note ?? ''}</td>
          </tr>
        ))}
      </Table>

      {admin.role === 'super' && <DeleteForm userId={p.id} email={p.email ?? ''} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{k}</dt>
      <dd className="break-all text-ink">{v || '—'}</dd>
    </div>
  );
}

function Table({
  title, head, empty, children,
}: { title: string; head: string[]; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="card overflow-x-auto">
      <h2 className="px-4 pt-4 text-sm font-semibold text-ink-2">{title}</h2>
      <table className="w-full">
        <thead><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>
          {children.length === 0 ? <tr><td className="td" colSpan={head.length}>{empty}</td></tr> : children}
        </tbody>
      </table>
    </section>
  );
}
