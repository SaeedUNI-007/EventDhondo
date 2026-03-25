"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ViewEventOrg() {
  const search = useSearchParams();
  const router = useRouter();
  const eventId = search.get("eventId");
  const [eventData, setEventData] = useState(null);
  const [message, setMessage] = useState("");
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("orgId") || "")
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
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
      const [h, m] = raw.split(":");
      return new Date(1970, 0, 1, Number(h), Number(m)).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;
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
          throw new Error(data?.message || "Failed to load event");
        }

        const ev = data.find((e) => String(e.EventID || e.id || e.eventId) === String(eventId));
        setEventData(ev || null);
      } catch (err) {
        setEventData(null);
        setMessage(err?.message || "Could not load event.");
      }
    };

    loadEvent();
  }, [eventId, userId]);

  if (!eventId) return <main className="min-h-screen shell"><div className="p-6">No event specified.</div></main>;
  if (!eventData) return <main className="min-h-screen shell"><div className="p-6">Event not found.</div></main>;

  async function handleDelete() {
    if (!confirm("Delete this event?")) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}?organizerId=${encodeURIComponent(userId || "")}`,
        { method: "DELETE" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Delete failed");
      }
      router.push("/dashboardO");
    } catch (err) {
      setMessage(err?.message || "Delete failed.");
    }
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

        {message && <p className="mb-3 text-sm text-slate-700">{message}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm"><strong>Date:</strong> {formatDate(eventData.eventDate || eventData.EventDate)}</p>
            <p className="text-sm"><strong>Time:</strong> {formatTime(eventData.eventTime || eventData.EventTime || eventData.Time)}</p>
            <p className="text-sm"><strong>Venue:</strong> {eventData.venue || eventData.Venue || "TBA"}</p>
            <p className="mt-3 text-sm">{eventData.description || eventData.Description || ""}</p>
          </div>

          <div className="p-4 bg-[var(--surface-soft)] rounded">
            <div className="flex gap-2 mb-3">
              <Link href={`/event/edit/${eventId}`} className="px-3 py-2 rounded border">Edit</Link>
              <button onClick={handleDelete} className="px-3 py-2 bg-red-600 text-white rounded">Delete</button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Registrations</h3>
              <p className="text-sm text-slate-600">Registration list endpoint is not available yet. This page is now connected for event details and deletion only.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}