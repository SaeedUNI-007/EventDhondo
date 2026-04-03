'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);

  function getDashboardHref() {
    if (typeof window === 'undefined') return '/dashboard';
    const role = (sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || '').toLowerCase();
    if (role === 'organizer') return '/dashboardO';
    if (role === 'admin') return '/dashboardA';
    return '/dashboard';
  }

  async function load(p = 1) {
    try {
      const res = await fetch(`/api/notifications?filter=all&page=${p}&limit=20`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(page); }, [page]);

  async function markRead(id) {
    try {
      await fetch('/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ids:[id] }) });
      setItems(items.map(i => i.notificationId === id ? { ...i, status: 'Read', readAt: new Date().toISOString() } : i));
    } catch (e) { console.error(e); }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Notifications</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(getDashboardHref())}
              className="px-3 py-1 rounded-md border bg-white text-sm"
            >
              Back to dashboard
            </button>
            <div className="text-sm text-slate-500">Page {page}</div>
          </div>
        </div>

        <div className="space-y-3">
          {items.length === 0 && <div className="text-sm text-slate-600">No notifications.</div>}

          {items.map(n => (
            <article key={n.notificationId} className="rounded-xl border border-[var(--stroke)] bg-white p-4 flex justify-between items-start">
              <div>
                <Link href={`/notifications/${n.notificationId}`} className={`${n.status === 'Pending' ? 'font-semibold' : 'font-medium'} text-[var(--brand-strong)]`}>{n.title}</Link>
                <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                <p className="text-xs text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
              </div>

              <div className="flex flex-col gap-2">
                {n.status !== 'Read' && <button onClick={() => markRead(n.notificationId)} className="rounded-md bg-[var(--brand)] text-white px-3 py-1 text-sm">Mark read</button>}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-md px-3 py-1 border">Prev</button>
          <button onClick={() => setPage(p => p + 1)} className="rounded-md px-3 py-1 border">Next</button>
        </div>
      </div>
    </main>
  );
}