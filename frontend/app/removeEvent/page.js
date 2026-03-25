"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function RemoveEventStudent() {
  const [events, setEvents] = useState([]);
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";

  useEffect(() => {
    const all = JSON.parse(localStorage.getItem("events") || "[]");
    const mine = all.filter(e => {
      const owner = (e.organizerId || e.organizer || e.createdBy || e.userId || "");
      return String(owner) === String(userId);
    });
    setEvents(mine);
  }, [userId]);

  function handleDelete(id) {
    if (!confirm("Delete this event?")) return;
    const all = JSON.parse(localStorage.getItem("events") || "[]").filter(x => String(x.id || x.EventID || x.eventId) !== String(id));
    localStorage.setItem("events", JSON.stringify(all));
    const mine = all.filter(e => {
      const owner = (e.organizerId || e.organizer || e.createdBy || e.userId || "");
      return String(owner) === String(userId);
    });
    setEvents(mine);
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Remove Events</h1>
            <p className="text-sm text-slate-600">Delete events you created (student-created events).</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm text-center w-44">
            <Link href="/dashboard" className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-6 bg-white rounded text-slate-600">You have no events to remove.</div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id || ev.EventID || ev.eventId} className="p-4 bg-white rounded shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-semibold">{ev.title || ev.Title}</div>
                  <div className="text-sm text-slate-600">{ev.eventDate || ev.EventDate || ""} • {ev.eventTime || ""} • {ev.venue || ev.Venue || ""}</div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/event/edit/${ev.id || ev.EventID || ev.eventId}`} className="px-3 py-2 rounded border text-sm">Edit</Link>
                  <button onClick={() => handleDelete(ev.id || ev.EventID || ev.eventId)} className="px-3 py-2 bg-red-600 text-white rounded">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}