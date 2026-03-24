"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function RequestsOrg() {
  const [pending, setPending] = useState([]);
  const [events, setEvents] = useState([]);
  const userId = typeof window !== "undefined" ? (localStorage.getItem("userId") || localStorage.getItem("orgId") || "org") : "org";

  useEffect(() => {
    const allReq = JSON.parse(localStorage.getItem("eventRequests") || "[]");
    const ev = JSON.parse(localStorage.getItem("events") || "[]");
    setEvents(ev);
    // requests for events owned by this organizer
    const myEventIds = new Set(ev.filter(e => String(e.organizerId || e.organizer || e.createdBy) === String(userId)).map(e => String(e.id)));
    const onlyPending = allReq.filter(r => myEventIds.has(String(r.eventId)) && (r.status || "Pending") === "Pending");
    setPending(onlyPending);
  }, [userId]);

  function titleForEvent(id) {
    const e = events.find(x => String(x.id) === String(id));
    return e ? `${e.title} — ${e.eventDate || ''}` : `Event ${id}`;
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Pending Requests for Your Events</h1>
            <p className="text-sm text-slate-600">Requests submitted by students for events you manage.</p>
          </div>
          <div>
            <div className="p-3 bg-white rounded shadow-sm text-center w-44">
              <Link href="/dashboardO" className="inline-block text-sm text-slate-600 hover:underline">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="p-6 bg-white rounded text-slate-600">No pending requests.</div>
        ) : (
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r.id} className="border rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{titleForEvent(r.eventId)}</h3>
                    <p className="text-sm text-slate-600">{r.eventType || r.type || ''}</p>
                  </div>
                  <div className="text-sm font-medium">
                    <span className="text-yellow-600">Pending</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div>
                    <p><strong>Date:</strong> {r.eventDate || r.date || "TBA"}</p>
                    <p><strong>Time:</strong> {r.eventTime || r.time || "TBA"}</p>
                    <p><strong>Venue:</strong> {r.venue || "TBA"}</p>
                  </div>
                  <div>
                    <p><strong>Seats requested:</strong> {r.seats ?? r.capacity ?? "N/A"}</p>
                    <p><strong>From:</strong> {r.userId || r.from || "Unknown"}</p>
                    <p><strong>Submitted:</strong> {new Date(r.submittedAt || r.createdAt || r.id).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => {
                    // approve: set status Approved & add registration
                    const all = JSON.parse(localStorage.getItem("eventRequests") || "[]");
                    const idx = all.findIndex(x=>String(x.id)===String(r.id));
                    if (idx === -1) return;
                    all[idx].status = "Approved";
                    localStorage.setItem("eventRequests", JSON.stringify(all));
                    // also add registration
                    const regs = JSON.parse(localStorage.getItem("registrations") || "[]");
                    regs.push({ id: Date.now(), eventId: r.eventId, userId: r.userId, seats: r.seats || 1, status: "Registered", registeredAt: new Date().toISOString() });
                    localStorage.setItem("registrations", JSON.stringify(regs));
                    setPending(p => p.filter(x => String(x.id) !== String(r.id)));
                  }} className="px-3 py-2 bg-[var(--brand)] text-white rounded">Approve</button>

                  <button onClick={() => {
                    const all = JSON.parse(localStorage.getItem("eventRequests") || "[]");
                    const idx = all.findIndex(x=>String(x.id)===String(r.id));
                    if (idx === -1) return;
                    all[idx].status = "Rejected";
                    localStorage.setItem("eventRequests", JSON.stringify(all));
                    setPending(p => p.filter(x => String(x.id) !== String(r.id)));
                  }} className="px-3 py-2 border rounded text-sm">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}