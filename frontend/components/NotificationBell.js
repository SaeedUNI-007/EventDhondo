'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const ref = useRef();

  async function load() {
    try {
      const res = await fetch('/api/notifications?filter=unread&limit=5', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setCount(json.total ?? (json.items || []).length);
    } catch (e) {
      console.error('load notifications', e);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', onDoc);
    return () => { clearInterval(t); document.removeEventListener('click', onDoc); };
  }, []);

  async function markRead(id) {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      setItems(prev => prev.filter(p => p.notificationId !== id));
      setCount(c => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Notifications"
        onClick={() => { setOpen(v => !v); if (!open) load(); }}
        className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-[var(--surface-soft)] transition"
      >
        <svg className="w-5 h-5 text-[var(--brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        {count > 0 && <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold text-white rounded-full bg-[var(--danger)]">{count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 z-50 surface-card shadow-lg rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--stroke)] flex items-center justify-between">
            <span className="font-semibold">Notifications</span>
            <Link href="/notifications" className="text-sm text-[var(--brand-strong)] hover:underline">View all</Link>
          </div>

          <ul className="max-h-72 overflow-auto">
            {items.length === 0 && <li className="px-4 py-3 text-sm text-slate-600">No new notifications</li>}
            {items.map(n => (
              <li key={n.notificationId} className="px-4 py-3 border-b border-[var(--stroke)] flex gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/notifications/${n.notificationId}`} className="block">
                    <div className={`text-sm ${n.status === 'Pending' ? 'font-semibold' : 'font-medium'}`}>{n.title}</div>
                    <div className="text-xs text-slate-600 truncate">{n.message}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                  </Link>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={(e) => { e.preventDefault(); markRead(n.notificationId); }}
                    title="Mark read"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[var(--surface-soft)] hover:bg-[var(--surface)]"
                  >
                    ✓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}