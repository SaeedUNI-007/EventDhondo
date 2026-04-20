"use client";
import Link from 'next/link';
import SidebarNotificationBell from '@/components/SidebarNotificationBell';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import ConfirmModal from '@/components/ConfirmModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// default event type options (from schema EventType)
const DEFAULT_EVENT_TYPES = [
  "Competition",
  "Workshop",
  "Seminar",
  "Cultural",
  "Sports"
];

export default function DashboardO() {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("Organization");
  const [userEmail, setUserEmail] = useState("");
  const [eventTypes, setEventTypes] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [dateOrder, setDateOrder] = useState("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'completed'
  const [removeCandidate, setRemoveCandidate] = useState("");
  const [userInterests, setUserInterests] = useState([]);
  const organizerId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId"))
    : null;
  const token = typeof window !== "undefined"
    ? (sessionStorage.getItem("token") || localStorage.getItem("token") || "")
    : "";

  function readStoredInterests(userId) {
    if (typeof window === 'undefined') return [];
    const keys = [
      `interests:${userId}`,
      'userInterests',
      'interests',
    ];
    for (const k of keys) {
      const v = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (!v) continue;
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch (e) {
        return v.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  useEffect(() => {
    const savedName = organizerId
      ? (
        localStorage.getItem(`displayName:${organizerId}`)
        || sessionStorage.getItem("displayName")
        || localStorage.getItem(`organizationName:${organizerId}`)
        || localStorage.getItem("displayName")
      )
      : (sessionStorage.getItem("displayName") || localStorage.getItem("displayName"));
    const savedEmail = organizerId
      ? (localStorage.getItem(`userEmail:${organizerId}`) || sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail"))
      : (sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail"));
    if (savedName) setOrgName(savedName);
    if (savedEmail) setUserEmail(savedEmail);
    setUserInterests(readStoredInterests(organizerId));

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError("");
        // Try to fetch organizer events; backend may accept ?organizerId or fallback to all and filter by organizer email
        let url = `${API_BASE_URL}/api/events`;
        if (organizerId) url += `?organizerId=${encodeURIComponent(organizerId)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load events");

        const list = Array.isArray(data) ? data : [];
        // If backend didn't support organizer filter, try filter client-side by Organizer or OrganizerID fields
        const filtered = organizerId
          ? list.filter((e) => String(e.OrganizerID || e.Organizer || "").includes(String(organizerId)) || (e.OrganizerEmail && e.OrganizerEmail === savedEmail))
          : (savedEmail ? list.filter((e) => (e.OrganizerEmail === savedEmail) || (e.Organizer && e.Organizer === savedEmail)) : list);

        setEvents(filtered);
        const cities = Array.from(new Set(filtered.map((e) => (e.City || e.city || "")).filter(Boolean)));
        setCityOptions(cities);
        // set default remove candidate to first event if exists
        if (filtered.length > 0) setRemoveCandidate(filtered[0].EventID || filtered[0].id || "");
      } catch (err) {
        setError(err?.message || "Server connection failed");
      } finally {
        setLoading(false);
      }
    };

    // set event types from schema
    setEventTypes(DEFAULT_EVENT_TYPES);

    fetchEvents();
  }, [organizerId]);

  // remove event handler (optimistic; calls backend DELETE if available)
  const handleRemoveEvent = async () => {
    if (!removeCandidate) {
      alert("Select an event to remove.");
      return;
    }
    if (!confirm("Are you sure you want to remove the selected event?")) return;

    try {
      // attempt backend delete, if API exists
      const res = await fetch(
        `${API_BASE_URL}/api/events/${encodeURIComponent(removeCandidate)}?organizerId=${encodeURIComponent(organizerId || "")}`,
        {
          method: "DELETE",
          headers: {
            "x-user-id": String(organizerId || ""),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (res.ok || res.status === 404) {
        // update client state
        const nextEvents = events.filter((e) => String(e.EventID || e.id || "") !== String(removeCandidate));
        setEvents(nextEvents);
        const next = nextEvents[0];
        setRemoveCandidate(next ? (next.EventID || next.id || "") : "");
      } else {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete event");
      }
    } catch (err) {
      alert("Remove failed: " + (err?.message || "server error"));
    }
  };

  // helper: check if an event matches user's interests
  function eventMatchesInterests(ev, interests) {
    if (!interests || interests.length === 0) return false;
    const kws = new Set();
    const add = (v) => {
      if (!v) return;
      if (Array.isArray(v)) v.forEach(x => add(x));
      else String(v).split(',').map(s => s.trim()).filter(Boolean).forEach(s => kws.add(s.toLowerCase()));
    };
    add(ev.EventType || ev.eventType);
    add(ev.Title || ev.title);
    add(ev.Description || ev.description);
    add(ev.Tags || ev.tags || ev.EventTags);
    if (ev.Title) (ev.Title || '').toLowerCase().split(/\W+/).forEach(t => t && kws.add(t));
    if (ev.Description) (ev.Description || '').toLowerCase().split(/\W+/).forEach(t => t && kws.add(t));
    const lowerInterests = interests.map(i => String(i).toLowerCase());
    for (const interest of lowerInterests) {
      for (const kw of kws) {
        if (kw.includes(interest) || interest.includes(kw)) return true;
      }
    }
    return false;
  }

  // apply client-side filters/sorting
  const visibleEvents = events
    .filter((e) => {
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch = !search || [e.Title, e.title, e.Description, e.description, e.Venue, e.venue]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));

      // determine whether search/filter is active (then do not apply interests filter)
      const searchActive = Boolean(
        (searchTerm && searchTerm.trim()) ||
        (selectedType && selectedType !== '') ||
        (selectedCity && selectedCity !== '')
      );

      // apply interest filter by default (when not actively searching) for organizer
      if (!searchActive && userInterests && userInterests.length > 0) {
        const matchesInterest = eventMatchesInterests(e, userInterests);
        // if not matching interests, filter out
        if (!matchesInterest) return false;
      }

      // filter by EventType from schema; empty = all
      const matchesType = !selectedType || String(e.EventType || e.EventCategory || "").toLowerCase() === String(selectedType).toLowerCase();
      const matchesCity = !selectedCity || String(e.City || e.city || "").toLowerCase() === String(selectedCity).toLowerCase();
      return matchesSearch && matchesType && matchesCity;
    })
    .sort((a, b) => {
      const da = a.EventDate ? new Date(a.EventDate) : new Date(a.date || null);
      const db = b.EventDate ? new Date(b.EventDate) : new Date(b.date || null);
      if (!da || !db) return 0;
      return dateOrder === "asc" ? da - db : db - da;
    });

  const upcomingEvents = visibleEvents.filter((ev) => ev.isCompleted !== true);
  const completedEvents = visibleEvents.filter((ev) => ev.isCompleted === true);
  const displayedEvents = viewMode === 'completed' ? completedEvents : upcomingEvents;

  // Side panel now only contains "Dashboard" (profile accessible via pencil icon)
  const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboardO' },
    { label: 'Add Event', href: '/eventO' },
    { label: 'Attendance', href: '/attendanceO' },
    { label: 'Remove Event', href: '/removeEventO' },
    { label: 'Requests', href: '/requestsO' },
    { label: 'Notifications', href: '/notifications' },
  ];

  const SidePanelContent = ({ compact = false }) => {
    const profilePic = typeof window !== "undefined"
      ? (
        organizerId
          ? (localStorage.getItem(`profilePictureURL:${organizerId}`) || "")
          : (localStorage.getItem("profilePictureURL") || "")
      )
      : "";
    return (
      <div className={`flex flex-col ${compact ? "items-start p-3" : "items-center py-8 px-6"} h-full`}>
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
              {profilePic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl text-white">{orgName.charAt(0)}</span>
              )}
            </div>
            <div className={`${compact ? "hidden" : "text-left"}`}>
              <h3 className="text-base font-semibold text-white leading-tight">{orgName}</h3>
              {userEmail && <p className="text-xs text-white/80">{userEmail}</p>}
            </div>
          </div>

          {/* pencil icon links to org profile (/profileO) */}
          <Link href="/profileO" className="inline-flex items-center justify-center rounded p-1.5 bg-white/90 hover:bg-white border border-[var(--stroke)]" aria-label="Edit organization profile">
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
                  <span className="flex items-center justify-between gap-2">
                    <span>{item.label}</span>
                    {item.href === '/notifications' && <SidebarNotificationBell />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={`w-full mt-6 border-t ${compact ? "border-slate-200 pt-3" : "border-white/25 pt-4"}`}>
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`${compact ? "text-slate-700 hover:text-slate-900" : "text-white/85 hover:text-white"} text-sm font-medium`}
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
      <ConfirmModal
        open={showLogoutModal}
        title="Log out"
        message="⚠️ You are about to log out. Do you want to continue?"
        onConfirm={() => { setShowLogoutModal(false); doLogout(); }}
        onCancel={() => setShowLogoutModal(false)}
      />
      <div className="shell mx-auto max-w-[1200px]">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-4 lg:ml-80">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Organization Dashboard</p>
            <h1 className="mt-1 text-2xl font-extrabold md:text-4xl break-words">Welcome, {orgName}!</h1>
            {userEmail && <p className="mt-2 text-sm text-slate-600">Signed in as {userEmail}</p>}
          </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link href="/eventO" className="inline-flex items-center rounded-md bg-[var(--brand)] text-white px-4 py-2 font-semibold">
                + Add Event
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <div className="inline-flex rounded-xl bg-[var(--surface-soft)] p-1">
              <button
                type="button"
                onClick={() => setViewMode('active')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'active' ? 'bg-white text-[var(--brand-strong)]' : 'text-slate-600'}`}
              >
                Your Events
              </button>
              <button
                type="button"
                onClick={() => setViewMode('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${viewMode === 'completed' ? 'bg-white text-[var(--brand-strong)]' : 'text-slate-600'}`}
              >
                Completed Events
              </button>
            </div>
          </div>
        </header>

        {/* filter controls aligned left below welcome bar */}
        <div className="mx-auto max-w-[1200px] lg:ml-80 px-4 mb-4">
          <div className="glass rounded-2xl p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, description, venue"
                  className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Event Type</label>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm">
                  <option value="">All types</option>
                  {eventTypes.map((it) => <option key={it} value={it}>{it}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Date</label>
                <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value)} className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm">
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">City</label>
                <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm">
                  <option value="">All cities</option>
                  {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Permanent left column attached to page edge for md+ (matches student) */}
        <div className="hidden lg:block">
          <aside className="fixed left-0 top-0 h-screen w-80 bg-[linear-gradient(180deg,#0f766e,#34d399)] border-r border-[var(--stroke)] z-10">
            <div className="sticky top-6 h-[calc(100vh-48px)] overflow-hidden">
              <SidePanelContent />
            </div>
          </aside>
        </div>

        {/* Main content container shifted right to make room for side panel */}
        <div className="mx-auto max-w-[1200px] lg:ml-80 px-4">
          {/* Mobile inline panel */}
          <div className="lg:hidden mb-6">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <SidePanelContent compact />
            </div>
          </div>

          <section className="pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{viewMode === 'active' ? 'Your Events' : 'Completed Events'}</h2>
              <span className="text-sm text-slate-500">{displayedEvents.length} events</span>
            </div>

            {loading && <p className="text-slate-600">Loading events...</p>}
            {error && <p className="rounded-lg bg-rose-50 p-3 text-[var(--danger)]">{error}</p>}
            {!loading && !error && displayedEvents.length === 0 && (
              <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-slate-600">
                {viewMode === 'active'
                  ? 'No active events found. Use "Add Event" to create one.'
                  : 'No completed events found yet.'}
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedEvents.map((ev) => (
                <article key={ev.EventID || ev.id || ev.eventId} className="surface-card reveal-up h-full overflow-hidden p-4 flex flex-col">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">{ev.EventType || ev.EventCategory || "Event"}</p>
                    <p className="text-xs font-semibold text-slate-500">{ev.EventDate ? new Date(ev.EventDate).toLocaleDateString() : (ev.date || "")}</p>
                  </div>
                  <h3 className="min-h-[56px] text-lg font-bold text-slate-900">{ev.Title || ev.title}</h3>
                  <p className="mt-1 min-h-[48px] text-sm text-slate-600">{ev.Description ? ev.Description.slice(0, 120) : ev.description}</p>
                  <p className="mt-2 text-sm text-slate-600">{ev.Venue || ev.venue}</p>
                  <p className="mt-1 text-sm text-slate-600">{ev.City || ev.city || 'City not specified'}</p>
                  <div className="mt-auto pt-4 flex gap-2">
                    <Link href={`/viewEventO?eventId=${ev.EventID || ev.id || ev.eventId || ""}`} className="cta px-3 py-2 text-sm font-semibold">View</Link>
                    <Link href={`/event/edit/${ev.EventID || ev.id || ev.eventId || ""}`} className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">Edit</Link>
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