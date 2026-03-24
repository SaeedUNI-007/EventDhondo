"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function ViewEventPage() {
  const search = useSearchParams();
  const router = useRouter();
  const eventId = search.get("eventId");
  const [eventData, setEventData] = useState(null);
  const [registrationsCount, setRegistrationsCount] = useState(0);
  const [userRegistered, setUserRegistered] = useState(false);
  const userId = typeof window !== "undefined" ? (localStorage.getItem("userId") || localStorage.getItem("userID") || "") : "";

  useEffect(() => {
    if (!eventId) return;
    const evs = JSON.parse(localStorage.getItem("events") || "[]");
    const ev = evs.find(e => String(e.id) === String(eventId) || String(e.eventId) === String(eventId));
    setEventData(ev || null);

    const regs = JSON.parse(localStorage.getItem("registrations") || "[]");
    const regsFor = regs.filter(r => String(r.eventId) === String(eventId) && (String(r.status || "").toLowerCase() === "registered"));
    setRegistrationsCount(regsFor.length);
    setUserRegistered(regsFor.some(r => String(r.userId) === String(userId)));
  }, [eventId, userId]);

  if (!eventId) return <main className="min-h-screen shell"><div className="p-6">No event specified.</div></main>;
  if (!eventData) return <main className="min-h-screen shell"><div className="p-6">Event not found.</div></main>;

  const capacity = Number(eventData.capacity ?? eventData.seats ?? 0);
  const seatsLeft = capacity ? Math.max(0, capacity - registrationsCount) : "Unlimited";
  const isFull = capacity && seatsLeft <= 0;

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{eventData.title || eventData.Title}</h1>
            <p className="text-sm text-slate-600">{eventData.eventType || eventData.EventType || ""}</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm text-center w-44">
            <Link href="/dashboard" className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-700"><strong>Date:</strong> {eventData.eventDate || eventData.EventDate || "TBA"}</p>
            <p className="text-sm text-slate-700"><strong>Time:</strong> {eventData.eventTime || eventData.Time || "TBA"}</p>
            <p className="text-sm text-slate-700"><strong>Venue:</strong> {eventData.venue || eventData.Venue || "TBA"}</p>
            <p className="text-sm text-slate-700 mt-2">{eventData.description || eventData.Description || ""}</p>
          </div>

          <div className="p-4 bg-[var(--surface-soft)] rounded">
            <p className="text-sm text-slate-600"><strong>Capacity:</strong> {capacity || "Unlimited"}</p>
            <p className="text-sm text-slate-600"><strong>Registered:</strong> {registrationsCount}</p>
            <p className="text-sm text-slate-600"><strong>Seats left:</strong> {seatsLeft}</p>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { router.push(`/registerEvent?eventId=${encodeURIComponent(eventId)}`); }}
                disabled={isFull || userRegistered}
                className={`cta px-4 py-2 ${isFull || userRegistered ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {userRegistered ? "Already registered" : (isFull ? "Event full" : "Register")}
              </button>

              <Link href={`/event/view/${eventId}`} className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                Details (full page)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}