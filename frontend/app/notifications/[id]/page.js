'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotificationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/notifications/${id}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(j => setNotif(j))
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  function getDashboardHref() {
    if (typeof window === 'undefined') return '/dashboard';
    const role = (sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || '').toLowerCase();
    if (role === 'organizer') return '/dashboardO';
    if (role === 'admin') return '/dashboardA';
    return '/dashboard';
  }

  function inferType(n) {
    if (!n) return 'Unknown';
    if (n.notificationType) return n.notificationType;
    const t = (n.title || '').toLowerCase();
    if (t.includes('reminder')) return 'EventReminder';
    if (t.includes('registration') && t.includes('confirm')) return 'RegistrationConfirmation';
    if (t.includes('deadline') || t.includes('watchlist')) return 'RegistrationDeadline';
    if (t.includes('new event') || t.includes('matching')) return 'NewEventMatch';
    if (t.includes('cancel') || t.includes('update')) return 'EventUpdate';
    if (t.includes('result') || t.includes('announcement')) return 'ResultAnnouncement';
    return 'Generic';
  }

  if (loading) return <main className="min-h-screen shell"><div className="surface-card p-6">Loading…</div></main>;
  if (error) return <main className="min-h-screen shell"><div className="surface-card p-6 text-red-600">Error: {error}</div></main>;
  if (!notif) return <main className="min-h-screen shell"><div className="surface-card p-6">Notification not found.</div></main>;

  const type = inferType(notif);

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">{notif.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
        </header>

        <section className="mb-6">
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{notif.message}</div>
        </section>

        {/* Type-specific details */}
        <section className="mb-6">
          {type === 'RegistrationConfirmation' && (
            <div className="text-sm">
              <p className="font-medium">Registration confirmed.</p>
              <p className="text-slate-600 mt-1">Check the event details below or go to your dashboard to view all registrations.</p>
            </div>
          )}

          {type === 'EventReminder' && (
            <div className="text-sm">
              <p className="font-medium">Event reminder</p>
              <p className="text-slate-600 mt-1">This reminder was scheduled according to your preferences.</p>
            </div>
          )}

          {type === 'RegistrationDeadline' && (
            <div className="text-sm">
              <p className="font-medium">Registration deadline alert</p>
              <p className="text-slate-600 mt-1">You watchlisted this event; consider registering before the deadline.</p>
            </div>
          )}

          {type === 'NewEventMatch' && (
            <div className="text-sm">
              <p className="font-medium">New event matches your interests</p>
              <p className="text-slate-600 mt-1">Events like this are suggested based on your selected interests.</p>
            </div>
          )}

          {type === 'EventUpdate' && (
            <div className="text-sm">
              <p className="font-medium">Event update / cancellation</p>
              <p className="text-slate-600 mt-1">Please check the event page for the latest status and instructions.</p>
            </div>
          )}

          {type === 'ResultAnnouncement' && (
            <div className="text-sm">
              <p className="font-medium">Results announced</p>
              <p className="text-slate-600 mt-1">Open the event page to see winners or certificates.</p>
            </div>
          )}

          {type === 'Generic' && <div className="text-sm text-slate-600">General notification.</div>}
        </section>

        {/* Links: open related event (if any) + back to dashboard */}
        <div className="flex items-center gap-3">
          {notif.relatedEventId && (
            <Link href={`/event/${notif.relatedEventId}`} className="px-4 py-2 rounded-md bg-[var(--brand)] text-white font-semibold">
              Open Event
            </Link>
          )}

          <button
            onClick={() => { router.push(getDashboardHref()); }}
            className="px-4 py-2 rounded-md border border-[var(--stroke)] bg-white text-slate-800"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </main>
  );
}