"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ViewEventPage() {
  const search = useSearchParams();
  const router = useRouter();
  const eventId = search.get("eventId");
  const [eventData, setEventData] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";

  function formatDate(value) {
    if (!value) return "TBA";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }

  function formatTime(value) {
    if (!value) return "TBA";
    const raw = String(value);

    // SQL TIME may come as "HH:mm:ss".
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
      const [h, m] = raw.split(":");
      return new Date(1970, 0, 1, Number(h), Number(m)).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Datetime-like values (e.g., 1970-01-01T09:00:00.000Z).
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  useEffect(() => {
    const loadEventAndStatus = async () => {
      if (!eventId) return;
      try {
        setMessage("");
        const res = await fetch(`${API_BASE_URL}/api/events`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
          throw new Error("Failed to load event");
        }

        const ev = data.find((e) => String(e.EventID || e.id || e.eventId) === String(eventId));
        setEventData(ev || null);

        const numericUserId = Number(userId);
        if (Number.isInteger(numericUserId) && numericUserId > 0) {
          const regRes = await fetch(`${API_BASE_URL}/api/events/registrations/${encodeURIComponent(numericUserId)}`);
          const regData = await regRes.json().catch(() => []);

          if (regRes.ok && Array.isArray(regData)) {
            const active = regData.some(
              (r) => String(r.EventID || r.eventId) === String(eventId) && String(r.Status || "").toLowerCase() !== "cancelled"
            );
            setIsRegistered(active);
          }
        }
      } catch (_err) {
        setEventData(null);
      }
    };

    loadEventAndStatus();
  }, [eventId, userId]);

  async function handleUnregister() {
    const numericUserId = Number(userId);
    const numericEventId = Number(eventId);

    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      setMessage("Please login again before unregistering.");
      return;
    }
    if (!Number.isInteger(numericEventId) || numericEventId <= 0) {
      setMessage("Invalid event id.");
      return;
    }

    setIsBusy(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/unregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: numericUserId, eventId: numericEventId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Failed to unregister");
      }

      setIsRegistered(false);
      setMessage(data?.message || "Unregistered successfully.");
    } catch (err) {
      setMessage(err?.message || "Failed to unregister.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!eventId) return <main className="min-h-screen shell"><div className="p-6">No event specified.</div></main>;
  if (!eventData) return <main className="min-h-screen shell"><div className="p-6">Event not found.</div></main>;

  const capacity = Number(eventData.Capacity ?? eventData.capacity ?? eventData.seats ?? 0);

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
            <p className="text-sm text-slate-700"><strong>Date:</strong> {formatDate(eventData.eventDate || eventData.EventDate)}</p>
            <p className="text-sm text-slate-700"><strong>Time:</strong> {formatTime(eventData.eventTime || eventData.EventTime || eventData.Time)}</p>
            <p className="text-sm text-slate-700"><strong>Venue:</strong> {eventData.venue || eventData.Venue || "TBA"}</p>
            <p className="text-sm text-slate-700 mt-2">{eventData.description || eventData.Description || ""}</p>
          </div>

          <div className="p-4 bg-[var(--surface-soft)] rounded">
            <p className="text-sm text-slate-600"><strong>Capacity:</strong> {capacity || "Unlimited"}</p>
            <p className="text-sm text-slate-600"><strong>Status:</strong> {eventData.Status || eventData.status || "Published"}</p>

            <div className="mt-4 flex gap-3">
              {isRegistered ? (
                <button onClick={handleUnregister} disabled={isBusy} className="rounded-md bg-red-600 px-4 py-2 text-white disabled:opacity-60">
                  {isBusy ? "Working..." : "Unregister"}
                </button>
              ) : (
                <button
                  onClick={() => { router.push(`/registerEvent?eventId=${encodeURIComponent(eventId)}`); }}
                  className="cta px-4 py-2"
                >
                  Register
                </button>
              )}

              <Link href={`/event/view/${eventId}`} className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                Details (full page)
              </Link>
            </div>

            {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}