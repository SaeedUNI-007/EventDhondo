"use client";
import { useEffect, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('Student');

  useEffect(() => {
    const savedName = localStorage.getItem('displayName');
    const savedEmail = localStorage.getItem('userEmail');
    if (savedName) {
      setDisplayName(savedName);
    } else if (savedEmail) {
      const fromEmail = savedEmail.split('@')[0].replace(/[._-]+/g, ' ');
      const titleCase = fromEmail.replace(/\b\w/g, (c) => c.toUpperCase());
      setDisplayName(titleCase || 'Student');
    }

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${API_BASE_URL}/api/events`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load events');
        }

        const normalized = Array.isArray(data)
          ? data.map((item) => ({
              id: item.EventID,
              title: item.Title,
              organizer: item.Organizer,
              date: item.EventDate,
              venue: item.Venue,
            }))
          : [];

        setEvents(normalized);
      } catch (err) {
        setError(err.message || 'Server connection failed');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const EventCard = ({ event }) => (
    <article className="surface-card reveal-up overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">{event.category || 'Campus Event'}</p>
        <p className="text-xs font-semibold text-slate-500">{new Date(event.date).toLocaleDateString()}</p>
      </div>
      <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{event.organizer}</p>
      <p className="mt-2 text-sm text-slate-600">{event.venue}</p>
      <button className="cta mt-4 w-full py-2 text-sm font-semibold">View Details</button>
    </article>
  );

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="shell">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Dashboard</p>
              <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Welcome, {displayName}!</h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">Explore upcoming events tailored for your campus interests.</p>
            </div>
            <a href="/" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Home</a>
          </div>
        </header>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recommended for You</h2>
            <span className="text-sm text-slate-500">{events.length} events</span>
          </div>

          {loading && <p className="text-slate-600">Loading events...</p>}
          {error && <p className="rounded-lg bg-rose-50 p-3 text-[var(--danger)]">{error}</p>}
          {!loading && !error && events.length === 0 && (
            <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-slate-600">No upcoming events found. Ensure your SQL view returns future published events.</p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}