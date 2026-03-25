"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function RemoveEventO() {
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("orgId") || "org")
    : "org";

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setMessage("");
        const organizerId = Number(userId);
        const hasValidOrganizer = Number.isInteger(organizerId) && organizerId > 0;
        const url = hasValidOrganizer
          ? `${API_BASE_URL}/api/events?organizerId=${encodeURIComponent(organizerId)}`
          : `${API_BASE_URL}/api/events`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.message || "Failed to load events");
        }

        const list = hasValidOrganizer
          ? data
          : data.filter((e) => String(e.OrganizerID || e.organizerId || e.organizer || e.createdBy) === String(userId));
        setEvents(list);
      } catch (err) {
        setMessage(err?.message || "Could not load organizer events.");
        setEvents([]);
      }
    };

    loadEvents();
  }, [userId]);

  async function handleDelete(id) {
    if (!confirm("Delete this event?")) return;

    try {
      setMessage("");
      const res = await fetch(
        `${API_BASE_URL}/api/events/${encodeURIComponent(id)}?organizerId=${encodeURIComponent(userId || "")}`,
        { method: "DELETE" }
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to delete event");
      }

      setEvents((prev) => prev.filter((e) => String(e.EventID || e.id || e.eventId) !== String(id)));
      setMessage(payload?.message || "Event removed.");
    } catch (err) {
      setMessage(err?.message || "Delete failed.");
    }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Remove Events</h1>
            <p className="text-sm text-slate-600">Delete events you created as an organizer.</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm text-center w-44">
            <Link href="/dashboardO" className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>

        {message && <p className="mb-3 text-sm text-slate-700">{message}</p>}

        {events.length === 0 ? (
          <div className="p-6 bg-white rounded text-slate-600">You have no events to remove.</div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.EventID || ev.id || ev.eventId} className="p-4 bg-white rounded shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-semibold">{ev.Title || ev.title}</div>
                  <div className="text-sm text-slate-600">{ev.EventDate || ev.eventDate} • {ev.EventTime || ev.eventTime} • {ev.Venue || ev.venue}</div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/event/edit/${ev.EventID || ev.id || ev.eventId}`} className="px-3 py-2 rounded border text-sm">Edit</Link>
                  <button onClick={() => handleDelete(ev.EventID || ev.id || ev.eventId)} className="px-3 py-2 bg-red-600 text-white rounded">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}