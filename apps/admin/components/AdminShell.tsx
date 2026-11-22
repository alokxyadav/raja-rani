'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getToken } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/courses', label: 'Courses' },
  { href: '/live-classes', label: 'Live Classes' },
  { href: '/orders', label: 'Orders & Payments' },
  { href: '/community', label: 'Community' },
  { href: '/certificates', label: 'Certificates' },
  { href: '/banners', label: 'Banners' },
  { href: '/coupons', label: 'Coupons' },
  { href: '/users', label: 'Users' },
  { href: '/support', label: 'Support' },
  { href: '/reports', label: 'Reports' },
  { href: '/audit-logs', label: 'Audit Logs' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings', label: 'Settings' },
  { href: '/account', label: 'Account Security' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Client-side guard — a UX redirect only. Every admin API call still gets
  // a real 401/403 from the backend if there's no valid admin token; this
  // just avoids flashing an empty/error dashboard before that round-trip.
  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-primary text-white flex flex-col">
        <div className="px-6 py-5 text-xl font-bold border-b border-white/10">Raja Rani</div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-6 py-2.5 text-sm ${
                  active ? 'bg-white/10 font-semibold' : 'text-white/80 hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="mx-4 mb-4 px-4 py-2 text-sm rounded-lg border border-white/20 hover:bg-white/10"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 bg-background p-8">{children}</main>
    </div>
  );
}
