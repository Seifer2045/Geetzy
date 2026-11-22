import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from './supabase/admin';
import { sessionClient } from './supabase/server';

export type AdminRole = 'super' | 'support';
export type Admin = { id: string; email: string; role: AdminRole };

// One lookup per request (React cache), reused by layout, pages and actions.
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser(); // verifies the JWT with Supabase
  const user = data.user;
  if (!user) return null;
  const { data: row } = await db().from('admins').select('role').eq('user_id', user.id).maybeSingle();
  if (!row) return null;
  return { id: user.id, email: user.email ?? '', role: row.role as AdminRole };
});

/** Pages: redirect to login when not an admin. */
export async function requireAdmin(role?: AdminRole): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  if (role === 'super' && admin.role !== 'super') redirect('/?denied=1');
  return admin;
}

/** Server actions: throw instead of redirect. */
export async function assertAdmin(role?: AdminRole): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new Error('Not signed in as admin');
  if (role === 'super' && admin.role !== 'super') throw new Error('Super admin only');
  return admin;
}

export async function audit(
  adminId: string,
  action: string,
  target?: { type?: string; id?: string },
  meta: Record<string, unknown> = {},
) {
  await db().from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    meta,
  });
}
