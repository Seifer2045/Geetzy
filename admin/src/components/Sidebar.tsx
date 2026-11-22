'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; superOnly?: boolean };

const ITEMS: Item[] = [
  { href: '/', label: 'Overview' },
  { href: '/users', label: 'Users' },
  { href: '/templates', label: 'Video templates' },
  { href: '/photo-templates', label: 'Photo templates' },
  { href: '/categories', label: 'Categories' },
  { href: '/api-keys', label: 'API keys', superOnly: true },
  { href: '/audit', label: 'Audit log' },
];

export function Sidebar({ role, email, logout }: { role: string; email: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-lg bg-brand px-2 py-1 text-xs font-bold">GEETZY</span>
        <span className="text-sm font-semibold text-ink-2">Admin</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        {ITEMS.filter((i) => !i.superOnly || role === 'super').map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
              active(i.href) ? 'bg-white/10 text-ink' : 'text-ink-muted hover:bg-white/5 hover:text-ink'
            }`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 border-t border-line pt-4 md:mt-auto">
        <p className="truncate text-xs text-ink-muted">{email}</p>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-faint">{role}</p>
        <form action={logout}>
          <button className="btn-glass w-full">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
