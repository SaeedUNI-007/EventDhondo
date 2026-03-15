"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// default event types (used for filter)
const DEFAULT_EVENT_TYPES = [
  "Competition",
  "Workshop",
  "Seminar",
  "Cultural",
  "Sports"
];

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('Student');
  const [userEmail, setUserEmail] = useState('');

  // filter state
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [dateOrder, setDateOrder] = useState('asc');

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
    if (savedEmail) setUserEmail(savedEmail);

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
              date: item.EventDate || item.date,
              venue: item.Venue,
              type: item.EventType || item.EventCategory || ''
            }))
          : [];

        setEvents(normalized);
      } catch (err) {
        setError(err.message || 'Server connection failed');
      } finally {
        setLoading(false);
      }
    };

    // set event types for filter UI (can be replaced by backend list later)
    setEventTypes(DEFAULT_EVENT_TYPES);

    fetchEvents();
  }, []);

  // apply filters + sorting
  const visibleEvents = events
    .filter((ev) => {
      if (!selectedType) return true;
      return String(ev.type || '').toLowerCase() === String(selectedType).toLowerCase();
    })
    .sort((a, b) => {
      const da = a.date ? new Date(a.date) : null;
      const db = b.date ? new Date(b.date) : null;
      if (!da || !db) return 0;
      return dateOrder === 'asc' ? da - db : db - da;
    });

  const EventCard = ({ event }) => (
    <article className="surface-card reveal-up overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">{event.type || event.category || 'Campus Event'}</p>
        <p className="text-xs font-semibold text-slate-500">{event.date ? new Date(event.date).toLocaleDateString() : ''}</p>
      </div>
      <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{event.organizer}</p>
      <p className="mt-2 text-sm text-slate-600">{event.venue}</p>
      <button className="cta mt-4 w-full py-2 text-sm font-semibold">View Details</button>
    </article>
  );

  // only Dashboard nav item visible under profile as requested
  const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard' }
  ];

  // left-side panel content (attached to left edge, wider, greenish background)
  const SidePanelContent = ({ compact = false }) => {
    const profilePic = localStorage.getItem('profilePictureURL') || '';
    return (
      <div className={`flex flex-col ${compact ? 'items-start p-3' : 'items-center py-8 px-6'} h-full`}>
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
              {profilePic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl text-white">{displayName.charAt(0)}</span>
              )}
            </div>
            <div className={`${compact ? 'hidden' : 'text-left'}`}>
              <h3 className="text-base font-semibold text-white leading-tight">{displayName}</h3>
              {userEmail && <p className="text-xs text-white/80">{userEmail}</p>}
            </div>
          </div>

          {/* small edit icon that links to profile page (keeps top edit control) */}
          <Link href="/profile" className="inline-flex items-center justify-center rounded p-1.5 bg-white/90 hover:bg-white border border-[var(--stroke)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--brand-strong)]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path fillRule="evenodd" d="M2 15.25V18h2.75l8.482-8.482-2.75-2.75L2 15.25z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        <nav className="w-full flex-1">
          <ul className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block w-full text-left rounded-md px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  };

  return (
    <main className="min-h-screen px-0 py-8">
      <div className="shell">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Dashboard</p>
              <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Welcome, {displayName}!</h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">Explore upcoming events tailored for your campus interests.</p>
            </div>
            <a href="/" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Home</a>
          </div>
        </header>

        {/* filter controls aligned left below welcome bar */}
        <div className="mx-auto max-w-[1200px] md:ml-80 px-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Event Type</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="rounded-md border px-3 py-1">
                <option value="">All types</option>
                {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Date</label>
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value)} className="rounded-md border px-3 py-1">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Permanent left column attached to page edge for md+ (wider, greenish background) */}
        <div className="hidden md:block">
          <aside className="fixed left-0 top-0 h-screen w-80 bg-[linear-gradient(180deg,#0f766e,#34d399)] border-r border-[var(--stroke)] z-10">
            <div className="sticky top-6 h-[calc(100vh-48px)] overflow-hidden">
              <SidePanelContent />
            </div>
          </aside>
        </div>

        {/* Main content container shifted right on md+ to make room for fixed left column (80 = 20rem) */}
        <div className="mx-auto max-w-[1200px] md:ml-80 px-4">
          {/* Mobile inline panel */}
          <div className="md:hidden mb-6">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <SidePanelContent compact />
            </div>
          </div>

          <section className="pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Recommended for You</h2>
              <span className="text-sm text-slate-500">{visibleEvents.length} events</span>
            </div>

            {loading && <p className="text-slate-600">Loading events...</p>}
            {error && <p className="rounded-lg bg-rose-50 p-3 text-[var(--danger)]">{error}</p>}
            {!loading && !error && visibleEvents.length === 0 && (
              <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-slate-600">No upcoming events found. Ensure your SQL view returns future published events.</p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}