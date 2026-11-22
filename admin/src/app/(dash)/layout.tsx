import { Sidebar } from '@/components/Sidebar';
import { requireAdmin } from '@/lib/auth';
import { logout } from '../login/actions';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar role={admin.role} email={admin.email} logout={logout} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
