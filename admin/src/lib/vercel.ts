import 'server-only';

// Minimal Vercel REST client for rotating the backend's env vars.
// Endpoints written from the public Vercel API docs — verify on the first real rotation.
const API = 'https://api.vercel.com';

function cfg() {
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_BACKEND_PROJECT_ID;
  if (!token || !project) {
    throw new Error('Set VERCEL_API_TOKEN and VERCEL_BACKEND_PROJECT_ID in the admin project env first.');
  }
  const team = process.env.VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '';
  return { token, project, team };
}

async function call(method: string, path: string, team: string, token: string, body?: unknown) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${team ? sep + team : ''}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

/** Create or replace an encrypted env var for production + preview. */
export async function upsertEnv(key: string, value: string) {
  const { token, project, team } = cfg();
  await call('POST', `/v10/projects/${project}/env?upsert=true`, team, token, {
    key, value, type: 'encrypted', target: ['production', 'preview'],
  });
}

/** Re-deploys the latest production deployment so the new env value is live. Returns the new deployment url. */
export async function redeployBackend(): Promise<string> {
  const { token, project, team } = cfg();
  const list = await call('GET', `/v6/deployments?projectId=${project}&target=production&limit=1&state=READY`, team, token);
  const latest = list.deployments?.[0];
  if (!latest) throw new Error('No production deployment found to redeploy.');
  const created = await call('POST', '/v13/deployments?forceNew=1', team, token, {
    name: latest.name, deploymentId: latest.uid, target: 'production',
  });
  return String(created.url ?? '');
}
