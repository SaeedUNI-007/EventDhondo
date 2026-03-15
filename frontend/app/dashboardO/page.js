"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("Organization");
  const [userEmail, setUserEmail] = useState("");
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [dateOrder, setDateOrder] = useState("asc");
  const [removeCandidate, setRemoveCandidate] = useState("");
  const organizerId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  useEffect(() => {
    const savedName = localStorage.getItem("displayName");
    const savedEmail = localStorage.getItem("userEmail");
    if (savedName) setOrgName(savedName);
    if (savedEmail) setUserEmail(savedEmail);

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
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(removeCandidate)}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        // update client state
        setEvents((prev) => prev.filter((e) => String(e.EventID || e.id || "") !== String(removeCandidate)));
        setRemoveCandidate(() => {
          const next = events.find((e) => String(e.EventID || e.id || "") !== String(removeCandidate));
          return next ? (next.EventID || next.id || "") : "";
        });
      } else {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete event");
      }
    } catch (err) {
      alert("Remove failed: " + (err?.message || "server error"));
    }
  };

  // apply client-side filters/sorting
  const visibleEvents = events
    .filter((e) => {
      // filter by EventType from schema; empty = all
      if (!selectedType) return true;
      return String(e.EventType || e.EventCategory || "").toLowerCase() === String(selectedType).toLowerCase();
    })
    .sort((a, b) => {
      const da = a.EventDate ? new Date(a.EventDate) : new Date(a.date || null);
      const db = b.EventDate ? new Date(b.EventDate) : new Date(b.date || null);
      if (!da || !db) return 0;
      return dateOrder === "asc" ? da - db : db - da;
    });

  // Side panel now only contains "Dashboard" (profile accessible via pencil icon)
  const NAV_ITEMS = [{ label: "Dashboard", href: "/dashboardO" }];

  const SidePanelContent = ({ compact = false }) => {
    const profilePic = localStorage.getItem("profilePictureURL") || "";
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
      <div className="shell mx-auto max-w-[1200px]">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Organization Dashboard</p>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Welcome, {orgName}!</h1>
            {userEmail && <p className="mt-2 text-sm text-slate-600">Signed in as {userEmail}</p>}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/events/new" className="cta inline-flex items-center px-4 py-2 font-semibold">+ Add Event</Link>

            {/* removed profile button here (profile accessible via pencil on side panel) */}
            {/* new Remove Event control: select + button */}
            <div className="inline-flex items-center gap-2 bg-white rounded-md p-2 border border-[var(--stroke)]">
              <select
                value={removeCandidate}
                onChange={(e) => setRemoveCandidate(e.target.value)}
                className="bg-white px-2 py-1 rounded-md text-sm border border-transparent"
                aria-label="Select event to remove"
              >
                <option value="">Select event</option>
                {events.map((ev) => (
                  <option key={ev.EventID || ev.id || ""} value={ev.EventID || ev.id || ""}>
                    {ev.Title || ev.title || `Event ${ev.EventID || ev.id || ""}`}
                  </option>
                ))}
              </select>
              <button onClick={handleRemoveEvent} className="rounded-md bg-rose-600 text-white px-3 py-1 text-sm font-semibold">Remove Event</button>
            </div>
          </div>
        </header>

        {/* filter controls aligned left below welcome bar */}
        <div className="mx-auto max-w-[1200px] md:ml-80 px-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Event Type</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="rounded-md border px-3 py-1">
                <option value="">All types</option>
                {eventTypes.map((it) => <option key={it} value={it}>{it}</option>)}
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

        {/* Permanent left column attached to page edge for md+ (matches student) */}
        <div className="hidden md:block">
          <aside className="fixed left-0 top-0 h-screen w-80 bg-[linear-gradient(180deg,#0f766e,#34d399)] border-r border-[var(--stroke)] z-10">
            <div className="sticky top-6 h-[calc(100vh-48px)] overflow-hidden">
              <SidePanelContent />
            </div>
          </aside>
        </div>

        {/* Main content container shifted right to make room for side panel */}
        <div className="mx-auto max-w-[1200px] md:ml-80 px-4">
          {/* Mobile inline panel */}
          <div className="md:hidden mb-6">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <SidePanelContent compact />
            </div>
          </div>

          <section className="pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your Events</h2>
              <span className="text-sm text-slate-500">{visibleEvents.length} events</span>
            </div>

            {loading && <p className="text-slate-600">Loading events...</p>}
            {error && <p className="rounded-lg bg-rose-50 p-3 text-[var(--danger)]">{error}</p>}
            {!loading && !error && visibleEvents.length === 0 && (
              <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-slate-600">No events found. Use "Add Event" to create one.</p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleEvents.map((ev) => (
                <article key={ev.EventID || ev.id || ev.eventId} className="surface-card reveal-up overflow-hidden p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">{ev.EventType || ev.EventCategory || "Event"}</p>
                    <p className="text-xs font-semibold text-slate-500">{ev.EventDate ? new Date(ev.EventDate).toLocaleDateString() : (ev.date || "")}</p>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{ev.Title || ev.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{ev.Description ? ev.Description.slice(0, 140) : ev.description}</p>
                  <p className="mt-2 text-sm text-slate-600">{ev.Venue || ev.venue}</p>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/events/${ev.EventID || ev.id || ""}`} className="cta px-3 py-2 text-sm font-semibold">View</Link>
                    <Link href={`/events/edit/${ev.EventID || ev.id || ""}`} className="rounded-md border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-soft)]">Edit</Link>
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