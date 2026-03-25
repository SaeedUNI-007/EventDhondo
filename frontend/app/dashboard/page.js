"use client";
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function DashboardStudent() {
  const [userRole, setUserRole] = useState('');
  const [events, setEvents] = useState([]);
  const [displayName, setDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [viewMode, setViewMode] = useState('available'); // 'available' | 'yours'
  // filter state (like organizer dashboard)
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [dateOrder, setDateOrder] = useState('asc'); // 'asc' | 'desc'
  const [searchTerm, setSearchTerm] = useState('');

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserRole((sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || '').toLowerCase());
      const id = sessionStorage.getItem('userId') || sessionStorage.getItem('userID') || localStorage.getItem('userId') || localStorage.getItem('userID');
      const name = id ? (localStorage.getItem(`displayName:${id}`) || sessionStorage.getItem('displayName') || localStorage.getItem('displayName')) : (sessionStorage.getItem('displayName') || localStorage.getItem('displayName'));
      const email = id ? (localStorage.getItem(`userEmail:${id}`) || sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail')) : (sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail'));
      if (name) setDisplayName(name);
      if (email) setUserEmail(email);

      const loadEvents = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/events`);
          const data = await res.json();
          if (!res.ok || !Array.isArray(data)) {
            throw new Error('Failed to load events');
          }

          setEvents(data);
          const types = Array.from(new Set(data.map(e => (e.eventType || e.EventType || 'Other')).filter(Boolean)));
          setEventTypes(types);
        } catch (_err) {
          setEvents([]);
          setEventTypes([]);
        }
      };

      loadEvents();
    }
  }, []);

  const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Achievements', href: '/achievementsU' },
    { label: 'Add Event', href: '/event' },
    { label: 'Remove Event', href: '/removeEvent' },
    { label: 'Requests', href: '/requestsU' },
     ];

  const userId = typeof window !== 'undefined'
    ? (sessionStorage.getItem('userId') || sessionStorage.getItem('userID') || localStorage.getItem('userId') || localStorage.getItem('userID'))
    : null;

  function isOwner(ev) {
    const oid = (ev.organizerId ?? ev.organizer ?? ev.createdBy ?? ev.creatorId ?? ev.userId);
    return String(oid || '') === String(userId || '');
  }

  // base set according to view mode
  const baseEvents = useMemo(() => {
    return events.filter(ev => {
      if (viewMode === 'yours') return isOwner(ev);
      const status = (ev.status || ev.Status || '').toString().toLowerCase();
      const published = status === 'published' || status === '';
      return published && !isOwner(ev);
    });
  }, [events, viewMode, userId]);

  // apply filters: type, search, date ordering
  const displayedEvents = useMemo(() => {
    let list = baseEvents.slice();
    if (selectedType && selectedType !== 'all') {
      list = list.filter(ev => ((ev.eventType || ev.EventType || '').toString().toLowerCase()) === selectedType.toString().toLowerCase());
    }
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(ev => ((ev.title || ev.Title || '') + ' ' + (ev.description || ev.Description || '')).toLowerCase().includes(q));
    }
    list.sort((a,b) => {
      const ad = new Date(a.eventDate || a.EventDate || 0).getTime();
      const bd = new Date(b.eventDate || b.EventDate || 0).getTime();
      return dateOrder === 'asc' ? ad - bd : bd - ad;
    });
    return list;
  }, [baseEvents, selectedType, searchTerm, dateOrder]);

  const SidePanelContent = ({ compact = false }) => {
    const profilePic = typeof window !== 'undefined'
      ? (userId ? (localStorage.getItem(`profilePictureURL:${userId}`) || '') : (localStorage.getItem('profilePictureURL') || ''))
      : '';

    return (
      <div className={`flex flex-col ${compact ? 'items-start p-3' : 'items-center py-8 px-6'} h-full`}>
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
              {profilePic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl text-white">{(displayName || 'Student').charAt(0)}</span>
              )}
            </div>
            <div className={`${compact ? 'hidden' : 'text-left'}`}>
              <h3 className="text-base font-semibold text-white leading-tight">{displayName || 'Student'}</h3>
              {userEmail && <p className="text-xs text-white/80">{userEmail}</p>}
            </div>
          </div>

          {/* pencil icon links to profile */}
          <Link href="/profile" className="inline-flex items-center justify-center rounded p-1.5 bg-white/90 hover:bg-white border border-[var(--stroke)]" aria-label="Edit profile">
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

        <div className={`w-full mt-6 border-t ${compact ? 'border-slate-200 pt-3' : 'border-white/25 pt-4'}`}>
          <Link href="/" className={`${compact ? 'text-slate-700 hover:text-slate-900' : 'text-white/85 hover:text-white'} text-sm font-medium`}>
            Return to Home
          </Link>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen px-0 py-8">
      <div className="shell mx-auto max-w-[1200px]">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-4 lg:ml-80">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Student Dashboard</p>
              <h1 className="mt-1 text-2xl font-extrabold md:text-4xl break-words">Welcome{displayName ? `, ${displayName}` : ''}!</h1>
              {userEmail && <p className="mt-2 text-sm text-slate-600">Signed in as {userEmail}</p>}
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              {userRole === 'student' && (
                <Link href="/event" className="inline-flex items-center rounded-md bg-[var(--brand)] text-white px-4 py-2 font-semibold">
                  + Add Event
                </Link>
              )}
            </div>
          </div>

          {/* Toggle between Available / Your Events */}
          <div className="mt-4">
            <div className="inline-flex rounded-xl bg-[var(--surface-soft)] p-1">
              <button type="button" onClick={() => setViewMode('available')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'available' ? 'bg-white text-[var(--brand-strong)]' : 'text-slate-600'}`}>
                Available Events
              </button>
              <button type="button" onClick={() => setViewMode('yours')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'yours' ? 'bg-white text-[var(--brand-strong)]' : 'text-slate-600'}`}>
                Your Events
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1200px] lg:ml-80 px-4 mb-4">
          <div className="glass rounded-2xl p-4 md:p-5">
            {/* Filter card centered — matches organizer layout, left helper line removed */}
            <div className="flex justify-center">
              <div className="w-full max-w-[980px]">
                <div className="rounded-lg bg-white p-3 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">Filter events</span>

                    <select
                      value={selectedType}
                      onChange={e => setSelectedType(e.target.value)}
                      className="p-2 rounded border bg-white text-sm"
                    >
                      <option value="all">All types</option>
                      {['Competition','Workshop','Seminar','Cultural','Sports']
                        .concat(eventTypes.filter(t => !['Competition','Workshop','Seminar','Cultural','Sports'].includes(t)))
                        .map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                      value={dateOrder}
                      onChange={e => setDateOrder(e.target.value)}
                      className="p-2 rounded border bg-white text-sm"
                    >
                      <option value="asc">Date: Oldest first</option>
                      <option value="desc">Date: Newest first</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      placeholder="Search title or description"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="p-2 rounded border text-sm w-56"
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedType('all'); setDateOrder('asc'); setSearchTerm(''); }}
                      className="px-3 py-2 rounded border text-sm text-slate-700 hover:bg-[var(--surface-soft)]"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <aside className="fixed left-0 top-0 h-screen w-80 bg-[linear-gradient(180deg,#0f766e,#34d399)] border-r border-[var(--stroke)] z-10">
            <div className="sticky top-6 h-[calc(100vh-48px)] overflow-hidden">
              <SidePanelContent />
            </div>
          </aside>
        </div>

        <div className="mx-auto max-w-[1200px] lg:ml-80 px-4">
          <div className="lg:hidden mb-6">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <SidePanelContent compact />
            </div>
          </div>

          <section className="pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{viewMode === 'available' ? 'Available Events' : 'Your Events'}</h2>
              <span className="text-sm text-slate-500">{displayedEvents.length} events</span>
            </div>

            {displayedEvents.length === 0 && (
              <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-slate-600">
                {viewMode === 'available'
                  ? 'No published events found. Check back later or switch to "Your Events" to manage your created events.'
                  : 'You have not created any events yet. Use "+ Add Event" to create one.'}
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedEvents.map(ev => (
                <article key={ev.EventID || ev.id || ev.eventId} className="surface-card reveal-up overflow-hidden p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">{ev.eventType || ev.EventType || "Event"}</p>
                    <p className="text-xs font-semibold text-slate-500">{formatDate(ev.EventDate || ev.eventDate)}</p>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{ev.title || ev.Title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{(ev.description || ev.Description || "").slice(0, 140)}</p>
                  <p className="mt-2 text-sm text-slate-600">{ev.venue || ev.Venue || 'TBA'}</p>

                  <div className="mt-4 flex gap-2">
                    {viewMode === 'available' ? (
                      <>
                        <Link href={`/viewEvent?eventId=${ev.EventID || ev.id || ev.eventId}`} className="cta px-3 py-2 text-sm font-semibold">Register</Link>
                        <Link href={`/event/view/${ev.EventID || ev.id || ev.eventId}`} className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">Details</Link>
                      </>
                    ) : (
                      <>
                        <Link href={`/event/edit/${ev.EventID || ev.id || ev.eventId}`} className="px-3 py-2 text-sm text-slate-700 rounded-md border hover:bg-[var(--surface-soft)]">Edit</Link>
                        <button onClick={async () => {
                          const targetId = ev.EventID || ev.id || ev.eventId;
                          const ok = window.confirm('Delete this event?');
                          if (!ok) return;
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(targetId)}?organizerId=${encodeURIComponent(userId || '')}`, {
                              method: 'DELETE',
                            });
                            if (!res.ok) {
                              throw new Error('Delete failed');
                            }
                            setEvents(prev => prev.filter(x => String(x.EventID || x.id || x.eventId) !== String(targetId)));
                          } catch (_err) {
                            window.alert('Could not delete event from server.');
                          }
                        }} className="px-3 py-2 text-sm text-white bg-red-600 rounded-md">Delete</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}