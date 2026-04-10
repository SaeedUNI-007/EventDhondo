'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getCurrentUserId() {
  if (typeof window === 'undefined') return '';
  return (
    sessionStorage.getItem('userId') ||
    sessionStorage.getItem('userID') ||
    localStorage.getItem('userId') ||
    localStorage.getItem('userID') ||
    ''
  );
}

function normalizeNotification(row) {
  return {
    notificationId: row.notificationId ?? row.NotificationID,
    title: row.title ?? row.Title ?? 'Untitled notification',
    message: row.message ?? row.Message ?? '',
    createdAt: row.createdAt ?? row.CreatedAt,
    status: row.status ?? row.Status ?? 'Pending',
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('unread');

  function getDashboardHref() {
    if (typeof window === 'undefined') return '/dashboard';
    const role = (sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || '').toLowerCase();
    if (role === 'organizer') return '/dashboardO';
    if (role === 'admin') return '/dashboardA';
    return '/dashboard';
  }

  async function load() {
    try {
      const userId = getCurrentUserId();
      const qs = new URLSearchParams({ filter: activeFilter, page: '1', limit: '1000' });
      if (userId) qs.set('userId', userId);
      const res = await fetch(`${API_BASE_URL}/api/notifications?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const normalized = (json.items || []).map(normalizeNotification);
      normalized.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setItems(normalized);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, [activeFilter]);

  async function markRead(id) {
    try {
      const userId = getCurrentUserId();
      await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ids:[id], ...(userId ? { userId: Number(userId) } : {}) })
      });
      setItems((prev) => {
        if (activeFilter === 'unread') {
          return prev.filter((i) => Number(i.notificationId) !== Number(id));
        }
        return prev.map(i => Number(i.notificationId) === Number(id) ? { ...i, status: 'Read', readAt: new Date().toISOString() } : i);
      });
    } catch (e) { console.error(e); }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Notifications</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => router.push(getDashboardHref())}
              className="px-3 py-1 rounded-md border bg-white text-sm"
            >
              Back to dashboard
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setActiveFilter('unread')}
            className={`rounded-md px-3 py-1.5 text-sm ${activeFilter === 'unread' ? 'bg-[var(--brand)] text-white' : 'border bg-white text-slate-700'}`}
          >
            Unread
          </button>
          <button
            onClick={() => setActiveFilter('all')}
            className={`rounded-md px-3 py-1.5 text-sm ${activeFilter === 'all' ? 'bg-[var(--brand)] text-white' : 'border bg-white text-slate-700'}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('read')}
            className={`rounded-md px-3 py-1.5 text-sm ${activeFilter === 'read' ? 'bg-[var(--brand)] text-white' : 'border bg-white text-slate-700'}`}
          >
            Read
          </button>
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

      </div>
    </main>
  );
}