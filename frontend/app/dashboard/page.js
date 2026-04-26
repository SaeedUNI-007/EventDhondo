"use client";
import Link from 'next/link';
import SidebarNotificationBell from '@/components/SidebarNotificationBell';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import ConfirmModal from '@/components/ConfirmModal';
import DashboardTour from '@/components/DashboardTour';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function DashboardStudent() {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [allEvents, setAllEvents] = useState([]);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [registeredEventIds, setRegisteredEventIds] = useState([]);
  const [registeringByEventId, setRegisteringByEventId] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [viewMode, setViewMode] = useState('available'); // 'available' | 'attended'
  // filter state (like organizer dashboard)
  const [eventTypes, setEventTypes] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [selectedType, setSelectedType] = useState('recommended');
  const [selectedCity, setSelectedCity] = useState('all');
  const [dateOrder, setDateOrder] = useState('asc'); // 'asc' | 'desc'
  const [searchTerm, setSearchTerm] = useState('');
  const [recommendationSummary, setRecommendationSummary] = useState('');
  const [recommendationSource, setRecommendationSource] = useState('');

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = sessionStorage.getItem('userId') || sessionStorage.getItem('userID') || localStorage.getItem('userId') || localStorage.getItem('userID');
      const name = id ? (localStorage.getItem(`displayName:${id}`) || sessionStorage.getItem('displayName') || localStorage.getItem('displayName')) : (sessionStorage.getItem('displayName') || localStorage.getItem('displayName'));
      const email = id ? (localStorage.getItem(`userEmail:${id}`) || sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail')) : (sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail'));
      if (name) setDisplayName(name);
      if (email) setUserEmail(email);

      const loadEvents = async () => {
        try {
          const headers = { 'Content-Type': 'application/json' };
          if (id) headers['x-user-id'] = String(id);

          const [allRes, recommendedRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/events`, { headers }),
            fetch(`${API_BASE_URL}/api/recommendations?userId=${encodeURIComponent(id || '')}&limit=50`, { headers }),
          ]);

          const allData = await allRes.json().catch(() => ([]));
          const recommendedData = await recommendedRes.json().catch(() => ({}));

          if (!allRes.ok || !Array.isArray(allData)) {
            throw new Error('Failed to load events');
          }

          const recommendedItems = Array.isArray(recommendedData?.items)
            ? recommendedData.items
            : (Array.isArray(recommendedData) ? recommendedData : []);

          setAllEvents(allData);
          setRecommendedEvents(recommendedItems);
          setRecommendationSource(String(recommendedData?.source || ''));
          setRecommendationSummary(
            recommendedItems.length > 0
              ? `Showing ${recommendedItems.length} recommendation${recommendedItems.length === 1 ? '' : 's'} from ${String(recommendedData?.source || 'recommendation engine')}.`
              : 'No personalized recommendations available yet.'
          );

          const types = Array.from(new Set(allData.map(e => (e.eventType || e.EventType || 'Other')).filter(Boolean)));
          const cities = Array.from(new Set(allData.map((e) => (e.city || e.City || e.organizerCity || e.OrganizerCity || '')).filter(Boolean)));
          setEventTypes(types);
          setCityOptions(cities);
        } catch (_err) {
          setAllEvents([]);
          setRecommendedEvents([]);
          setRecommendationSummary('');
          setRecommendationSource('');
          setEventTypes([]);
          setCityOptions([]);
        }
      };

      const loadRegistrations = async () => {
        try {
          if (!id || !Number.isInteger(Number(id))) {
            setRegisteredEventIds([]);
            return;
          }

          const res = await fetch(`${API_BASE_URL}/api/events/registrations/${encodeURIComponent(id)}`);
          const data = await res.json();
          if (!res.ok || !Array.isArray(data)) {
            throw new Error('Failed to load registrations');
          }

          const activeEventIds = data
            .filter((r) => String(r.Status || '').toLowerCase() !== 'cancelled')
            .map((r) => Number(r.EventID || r.eventId))
            .filter((n) => Number.isInteger(n));

          setRegisteredEventIds(Array.from(new Set(activeEventIds)));
        } catch (_err) {
          setRegisteredEventIds([]);
        }
      };

      loadEvents();
      loadRegistrations();
    }
  }, []);

  const NAV_ITEMS = [
    { label: 'Dashboard',    href: '/dashboard',     tourId: 'tour-nav-dashboard'    },
    { label: 'QR Code',      href: '/qr-code',       tourId: 'tour-nav-qr'           },
    { label: 'Achievements', href: '/achievementsU', tourId: 'tour-nav-achievements' },
    { label: 'Add Event',    href: '/event',         tourId: 'tour-nav-addevent'     },
    { label: 'Remove Event', href: '/removeEvent',   tourId: 'tour-nav-removeevent'  },
    { label: 'Requests',     href: '/requestsU',     tourId: 'tour-nav-requests'     },
    { label: 'Notifications',href: '/notifications', tourId: 'tour-nav-notifications'},
  ];

  const userId = typeof window !== 'undefined'
    ? (sessionStorage.getItem('userId') || sessionStorage.getItem('userID') || localStorage.getItem('userId') || localStorage.getItem('userID'))
    : null;

  function isOwner(ev) {
    const oid = (ev.organizerId ?? ev.organizer ?? ev.createdBy ?? ev.creatorId ?? ev.userId);
    return String(oid || '') === String(userId || '');
  }

  const isAlreadyRegistered = (eventIdValue) => {
    const idNum = Number(eventIdValue);
    return Number.isInteger(idNum) && registeredEventIds.includes(idNum);
  };

  const handleQuickRegister = async (eventIdValue) => {
    const parsedUserId = Number(userId);
    const parsedEventId = Number(eventIdValue);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      setActionMessage('Please login again before registering.');
      return;
    }

    if (!Number.isInteger(parsedEventId) || parsedEventId <= 0) {
      setActionMessage('Invalid event selected.');
      return;
    }

    if (isAlreadyRegistered(parsedEventId)) {
      setActionMessage('You are already registered for this event.');
      return;
    }

    setRegisteringByEventId((prev) => ({ ...prev, [parsedEventId]: true }));
    setActionMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(parsedUserId),
        },
        body: JSON.stringify({ eventId: parsedEventId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Registration failed');
      }

      setRegisteredEventIds((prev) => (prev.includes(parsedEventId) ? prev : [...prev, parsedEventId]));
      setActionMessage(data?.message || 'Registered successfully.');
    } catch (err) {
      setActionMessage(err?.message || 'Registration failed.');
    } finally {
      setRegisteringByEventId((prev) => ({ ...prev, [parsedEventId]: false }));
    }
  };

  // base set according to view mode
  const baseEvents = useMemo(() => {
    if (viewMode === 'attended') {
      return allEvents.filter((ev) => {
        const eventId = Number(ev.EventID || ev.id || ev.eventId);
        const registered = Number.isInteger(eventId) && registeredEventIds.includes(eventId);
        return registered && ev.isCompleted === true;
      });
    }

    const sourceEvents = selectedType === 'recommended' ? recommendedEvents : allEvents;

    return sourceEvents.filter((ev) => {
      const status = (ev.status || ev.Status || '').toString().toLowerCase();
      const published = status === 'published' || status === '';
      return published && ev.isCompleted !== true && !isOwner(ev);
    });
  }, [allEvents, recommendedEvents, viewMode, registeredEventIds, userId, selectedType]);

  // apply filters: type, search, date ordering, and interest-filter by default
  const displayedEvents = useMemo(() => {
    let list = baseEvents.slice();

    if (selectedType && selectedType !== 'all' && selectedType !== 'recommended') {
      list = list.filter(ev => ((ev.eventType || ev.EventType || '').toString().toLowerCase()) === selectedType.toString().toLowerCase());
    }
    if (selectedCity && selectedCity !== 'all') {
      list = list.filter((ev) => ((ev.city || ev.City || ev.organizerCity || ev.OrganizerCity || '').toString().toLowerCase()) === selectedCity.toString().toLowerCase());
    }
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(ev => ((ev.title || ev.Title || '') + ' ' + (ev.description || ev.Description || '')).toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (selectedType === 'recommended') {
        const aScore = Number(a.RecommendationScore || a.recommendationScore || 0);
        const bScore = Number(b.RecommendationScore || b.recommendationScore || 0);
        if (bScore !== aScore) return bScore - aScore;
      }

      const ad = new Date(a.eventDate || a.EventDate || 0).getTime();
      const bd = new Date(b.eventDate || b.EventDate || 0).getTime();
      return dateOrder === 'asc' ? ad - bd : bd - ad;
    });
    return list;
  }, [baseEvents, selectedType, selectedCity, searchTerm, dateOrder, viewMode]);

  function doLogout() {
    const uid = sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId');
    sessionStorage.removeItem('userID'); sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userRole'); sessionStorage.removeItem('token'); sessionStorage.removeItem('displayName'); sessionStorage.removeItem('userEmail');
    localStorage.removeItem('token'); localStorage.removeItem('userRole'); localStorage.removeItem('displayName'); localStorage.removeItem('userEmail');
    if (uid) {
      localStorage.removeItem(`displayName:${uid}`); localStorage.removeItem(`userEmail:${uid}`);
      sessionStorage.removeItem(`displayName:${uid}`); sessionStorage.removeItem(`userEmail:${uid}`);
    }
    router.push('/');
  }

  const SidePanelContent = ({ compact = false }) => {
    const profilePic = typeof window !== 'undefined'
      ? (userId ? (localStorage.getItem(`profilePictureURL:${userId}`) || '') : (localStorage.getItem('profilePictureURL') || ''))
      : '';

    return (
      <div className={`flex flex-col ${compact ? 'items-start p-3' : 'items-center py-8 px-6'} h-full`}>
        <div className="w-full flex items-center justify-between mb-6" id="tour-profile">
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
                <Link href={item.href} id={item.tourId} className="sidebar-nav-link">
                  <span className="flex items-center justify-between gap-2">
                    <span>{item.label}</span>
                    {item.href === '/notifications' && <SidebarNotificationBell />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={`w-full mt-6 border-t ${compact ? 'border-slate-200 pt-3' : 'border-white/25 pt-4'}`}>
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`${compact ? 'text-slate-700 hover:text-slate-900' : 'text-white/85 hover:text-white'} text-sm font-medium`}
          >
            Logout
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen px-0 py-8">
      <AuthGuard />
      <DashboardTour userId={userId} />
      <ConfirmModal
        open={showLogoutModal}
        title="Log out"
        message="⚠️ You are about to log out. Do you want to continue?"
        onConfirm={() => { setShowLogoutModal(false); doLogout(); }}
        onCancel={() => setShowLogoutModal(false)}
      />
      <div className="shell mx-auto max-w-[1600px]">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-4 lg:ml-80">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Student Dashboard</p>
              <h1 className="mt-1 text-2xl font-extrabold md:text-4xl break-words">Welcome{displayName ? `, ${displayName}` : ''}!</h1>
              {userEmail && <p className="mt-2 text-sm text-slate-600">Signed in as {userEmail}</p>}
            </div>

            <div className="flex flex-col gap-3 md:items-end" />
          </div>

          {/* Toggle between Available / Attended Events */}
          <div className="mt-4">
            <div id="tour-view-toggle" className="inline-flex rounded-xl bg-[var(--surface-soft)] p-1">
              <button type="button" onClick={() => setViewMode('available')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'available' ? 'bg-white text-[var(--brand-strong)]' : 'text-slate-600'}`}>
                Available Events
              </button>
              <button type="button" onClick={() => setViewMode('attended')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'attended' ? 'bg-white text-[var(--brand-strong)]' : 'text-slate-600'}`}>
                Attended Events
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[2000px] lg:ml-80 px-4 mb-4">
          {/* Single filter box */}
          <div className="flex justify-center">
            <div id="tour-event-filters" className="w-full max-w-[1300px] rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex justify-center">
                  <span className="text-sm font-semibold text-center">Filter events</span>
                </div>

                <div className="flex flex-row flex-nowrap items-center justify-center gap-2 min-w-0 w-full overflow-hidden">
                    <select
                      value={selectedType}
                      onChange={e => setSelectedType(e.target.value)}
                      className="p-2 rounded border bg-white text-sm w-[115px] shrink-0"
                    >
                      <option value="recommended">Recommended</option>
                      <option value="all">All types</option>
                      {['Competition','Workshop','Seminar','Cultural','Sports']
                        .concat(eventTypes.filter(t => !['Competition','Workshop','Seminar','Cultural','Sports'].includes(t)))
                        .map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                      value={dateOrder}
                      onChange={e => setDateOrder(e.target.value)}
                      className="p-2 rounded border bg-white text-sm w-[150px] shrink-0"
                    >
                      <option value="asc">Date: Oldest first</option>
                      <option value="desc">Date: Newest first</option>
                    </select>

                    <select
                      value={selectedCity}
                      onChange={e => setSelectedCity(e.target.value)}
                      className="p-2 rounded border bg-white text-sm w-[115px] shrink-0"
                    >
                      <option value="all">All cities</option>
                      {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <input
                      placeholder="Search title or description"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="p-2 rounded border text-sm flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedType('recommended'); setSelectedCity('all'); setDateOrder('asc'); setSearchTerm(''); }}
                      className="px-2.5 py-2 rounded border text-sm text-slate-700 hover:bg-[var(--surface-soft)] whitespace-nowrap shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>

        <div className="hidden lg:block">
          <aside id="tour-sidebar" className="fixed left-0 top-0 h-screen w-80 bg-[linear-gradient(180deg,#0f766e,#34d399)] border-r border-[var(--stroke)] z-10">
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
              <h2 className="text-2xl font-bold">{viewMode === 'available' ? 'Available Events' : 'Attended Events'}</h2>
              <span className="text-sm text-slate-500">{displayedEvents.length} events</span>
            </div>

            {actionMessage && (
              <p className="mb-3 rounded-lg bg-[var(--surface-soft)] p-3 text-sm text-slate-700">{actionMessage}</p>
            )}

            {displayedEvents.length === 0 && (
              <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-slate-600">
                {viewMode === 'available'
                  ? 'No published events found. Check back later or switch to "Attended Events" to view events you have attended.'
                  : 'You have not attended any events yet. Register for events in "Available Events" and attend to see them here.'}
              </p>
            )}

            <div id="tour-event-cards" className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedEvents.map(ev => (
                <article key={ev.EventID || ev.id || ev.eventId} className="surface-card reveal-up h-full overflow-hidden p-4 flex flex-col">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">{ev.eventType || ev.EventType || "Event"}</p>
                      {viewMode === 'available' && selectedType === 'recommended' && (
                        <p className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {ev.RecommendationReason || ev.recommendationReason || 'Recommended'}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-xs font-semibold text-slate-500">{formatDate(ev.EventDate || ev.eventDate)}</p>
                  </div>
                  <h3 className="min-h-[56px] text-lg font-bold text-slate-900">{ev.title || ev.Title}</h3>
                  <p className="mt-1 min-h-[48px] text-sm text-slate-600">{(ev.description || ev.Description || "").slice(0, 120)}</p>
                  <p className="mt-2 text-sm text-slate-600">{ev.venue || ev.Venue || 'TBA'}</p>
                  <p className="mt-1 text-sm text-slate-600">{ev.city || ev.City || ev.organizerCity || ev.OrganizerCity || 'City not specified'}</p>

                  <div className="mt-auto pt-4 flex gap-2">
                    {viewMode === 'available' ? (
                      <>
                        {isAlreadyRegistered(ev.EventID || ev.id || ev.eventId) ? (
                          <button type="button" disabled className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white opacity-80">
                            Registered
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickRegister(ev.EventID || ev.id || ev.eventId)}
                            disabled={Boolean(registeringByEventId[Number(ev.EventID || ev.id || ev.eventId)])}
                            className="dashboard-button cta px-3 py-2 text-sm font-semibold disabled:opacity-70"
                          >
                            {Boolean(registeringByEventId[Number(ev.EventID || ev.id || ev.eventId)]) ? 'Registering...' : 'Register'}
                          </button>
                        )}
                        <Link href={`/viewEvent?eventId=${ev.EventID || ev.id || ev.eventId}`} className="dashboard-button rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">View Details</Link>
                      </>
                    ) : (
                      <Link href={`/viewEvent?eventId=${ev.EventID || ev.id || ev.eventId}`} className="dashboard-button rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">View Details</Link>
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