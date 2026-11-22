import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { dateTime, num, usd } from '@/lib/format';
import { RotateKeyForm } from '@/components/RotateKeyForm';

export default async function ApiKeysPage() {
  await requireAdmin('super');
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [prov, usage] = await Promise.all([
    db().from('api_providers').select('*').order('provider'),
    db().from('ai_requests').select('provider,ok,est_cost_usd,latency_ms').gte('created_at', since).limit(20000),
  ]);

  const stats = new Map<string, { calls: number; errors: number; cost: number; lat: number; latN: number }>();
  for (const r of usage.data ?? []) {
    const k = r.provider ?? 'unknown';
    const s = stats.get(k) ?? { calls: 0, errors: 0, cost: 0, lat: 0, latN: 0 };
    s.calls++; if (!r.ok) s.errors++;
    s.cost += Number(r.est_cost_usd ?? 0);
    if (r.latency_ms) { s.lat += r.latency_ms; s.latN++; }
    stats.set(k, s);
  }
  const configured = !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_BACKEND_PROJECT_ID);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">API keys</h1>
        <p className="text-sm text-ink-muted">
          Keys live in the backend&apos;s Vercel environment. Rotating tests the new key, saves it to Vercel and redeploys the backend.
          Full keys are never shown or stored here.
        </p>
        {!configured && (
          <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
            Rotation is off: add VERCEL_API_TOKEN and VERCEL_BACKEND_PROJECT_ID to this admin project&apos;s environment.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(prov.data ?? []).map((p) => {
          const s = stats.get(p.provider);
          return (
            <section key={p.provider} className="card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.label}</h2>
                  <p className="font-mono text-xs text-ink-faint">{p.env_var}</p>
                </div>
                <span className="pill font-mono">{p.last4 ? `••••${p.last4}` : 'not rotated here yet'}</span>
              </div>
              <dl className="grid grid-cols-4 gap-2 text-center">
                <Mini k="Calls 30d" v={num(s?.calls ?? 0)} />
                <Mini k="Errors" v={num(s?.errors ?? 0)} bad={!!s?.errors} />
                <Mini k="Avg ms" v={s?.latN ? num(Math.round(s.lat / s.latN)) : '—'} />
                <Mini k="Est. cost" v={usd(s?.cost ?? 0)} />
              </dl>
              <p className="text-xs text-ink-muted">
                Last rotated: {dateTime(p.rotated_at)} · Last check: {p.last_check_at ? `${dateTime(p.last_check_at)} ${p.last_check_ok ? '✓' : '✗'}` : '—'}
              </p>
              <RotateKeyForm provider={p.provider} />
            </section>
          );
        })}
      </div>
      <p className="text-xs text-ink-faint">Usage numbers come from the backend&apos;s own request log (estimated cost, not real billing).</p>
    </div>
  );
}

function Mini({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.04] p-2">
      <dd className={`text-base font-bold ${bad ? 'text-danger' : ''}`}>{v}</dd>
      <dt className="text-[10px] uppercase tracking-wider text-ink-faint">{k}</dt>
    </div>
  );
}
