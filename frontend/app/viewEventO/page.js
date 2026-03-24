"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function ViewEventOrg() {
  const search = useSearchParams();
  const router = useRouter();
  const eventId = search.get("eventId");
  const [eventData, setEventData] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const userId = typeof window !== "undefined" ? (localStorage.getItem("userId") || localStorage.getItem("orgId") || "") : "";

  useEffect(() => {
    if (!eventId) return;
    const evs = JSON.parse(localStorage.getItem("events") || "[]");
    const ev = evs.find(e => String(e.id) === String(eventId) || String(e.eventId) === String(eventId));
    setEventData(ev || null);

    const regs = JSON.parse(localStorage.getItem("registrations") || "[]");
    const regsFor = regs.filter(r => String(r.eventId) === String(eventId) && (String(r.status || "").toLowerCase() === "registered"));
    setRegistrations(regsFor);
  }, [eventId]);

  if (!eventId) return <main className="min-h-screen shell"><div className="p-6">No event specified.</div></main>;
  if (!eventData) return <main className="min-h-screen shell"><div className="p-6">Event not found.</div></main>;

  function handleDelete() {
    if (!confirm("Delete this event?")) return;
    const all = JSON.parse(localStorage.getItem("events") || "[]").filter(x => String(x.id) !== String(eventId));
    localStorage.setItem("events", JSON.stringify(all));
    router.push("/dashboardO");
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{eventData.title || eventData.Title}</h1>
            <p className="text-sm text-slate-600">{eventData.eventType || eventData.EventType || ""}</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm text-center w-44">
            <Link href="/dashboardO" className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm"><strong>Date:</strong> {eventData.eventDate || eventData.EventDate || "TBA"}</p>
            <p className="text-sm"><strong>Time:</strong> {eventData.eventTime || eventData.Time || "TBA"}</p>
            <p className="text-sm"><strong>Venue:</strong> {eventData.venue || eventData.Venue || "TBA"}</p>
            <p className="mt-3 text-sm">{eventData.description || eventData.Description || ""}</p>
          </div>

          <div className="p-4 bg-[var(--surface-soft)] rounded">
            <div className="flex gap-2 mb-3">
              <Link href={`/event/edit/${eventId}`} className="px-3 py-2 rounded border">Edit</Link>
              <button onClick={handleDelete} className="px-3 py-2 bg-red-600 text-white rounded">Delete</button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Registrations ({registrations.length})</h3>
              {registrations.length === 0 ? (
                <p className="text-sm text-slate-600">No registrations yet.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {registrations.map(r => (
                    <div key={r.id} className="p-2 bg-white rounded border">
                      <div><strong>User:</strong> {r.userId}</div>
                      <div><strong>Seats:</strong> {r.seats || 1}</div>
                      <div><strong>At:</strong> {new Date(r.registeredAt || r.createdAt || r.id).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}