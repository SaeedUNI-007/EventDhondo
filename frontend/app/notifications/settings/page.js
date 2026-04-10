'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState([]);

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
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_BASE_URL}/api/notifications/settings${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setPrefs(json.preferences || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  function toggle(i, field) {
    const copy = [...prefs];
    copy[i] = { ...copy[i], [field]: !copy[i][field] };
    setPrefs(copy);
  }

  async function save() {
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_BASE_URL}/api/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs, ...(userId ? { userId: Number(userId) } : {}) })
      });
      if (res.ok) {
        const el = document.getElementById('ns-save-ok');
        if (el) { el.textContent = 'Saved'; setTimeout(() => (el.textContent = ''), 2000); }
      } else throw new Error('save failed');
    } catch (e) {
      alert('Failed to save settings');
      console.error(e);
    }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Notification Settings</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(getDashboardHref())}
              className="px-3 py-1 rounded-md border bg-white text-sm"
            >
              Back to dashboard
            </button>
            <div id="ns-save-ok" className="text-sm text-[var(--brand-strong)]" aria-live="polite"></div>
          </div>
        </div>

        <div className="space-y-2">
          {prefs.length === 0 && <div className="text-sm text-slate-600">No notification types configured.</div>}

          {prefs.map((p, i) => (
            <div key={p.notificationType} className="flex items-center justify-between p-3 border border-[var(--stroke)] rounded-lg bg-white">
              <div>
                <div className="font-semibold text-[var(--brand-strong)]">{p.notificationType}</div>
                <div className="text-sm text-slate-600">{p.description || ''}</div>
              </div>

              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!p.inAppEnabled} onChange={() => toggle(i, 'inAppEnabled')} />
                  <span className="text-sm">In-app</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!p.emailEnabled} onChange={() => toggle(i, 'emailEnabled')} />
                  <span className="text-sm">Email</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={save} className="px-4 py-2 rounded-md bg-[var(--brand)] text-white font-semibold">Save</button>
        </div>
      </div>
    </main>
  );
}