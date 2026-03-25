"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function RegisterEventPage() {
  const search = useSearchParams();
  const preselectedEventId = search.get("eventId");
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [msg, setMsg] = useState("");

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
    const loadEvents = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/events`);
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.message || "Failed to load events");
        }

        setEvents(data);
        if (preselectedEventId) {
          setSelectedEventId(String(preselectedEventId));
        } else if (data.length) {
          setSelectedEventId(String(data[0].EventID || data[0].id || ""));
        }
      } catch (_err) {
        setMsg("Could not load events from server.");
      }
    };

    loadEvents();
  }, [preselectedEventId]);

  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");

    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      setMsg("Please login again before registering for an event.");
      return;
    }

    if (!selectedEventId) {
      setMsg("Select an event to register.");
      return;
    }

    const eventId = Number(selectedEventId);
    const ev = events.find(x => String(x.EventID || x.id) === String(selectedEventId));
    if (!ev) {
      setMsg("Selected event not found.");
      return;
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
      setMsg("Selected event has invalid id.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: numericUserId, eventId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Registration failed");
      }

      setMsg(data?.message || "Registration request submitted.");
    } catch (err) {
      setMsg(err?.message || "Registration failed.");
    }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">Register for an Event</h1>
        <p className="text-sm text-slate-600 mb-4">Select a published event and submit registration. Each student registration is for one seat.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Event *</label>
            <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full p-2 border rounded">
              {events.length === 0 && <option value="">No events published</option>}
              {events.map(ev => (
                <option key={ev.EventID || ev.id} value={ev.EventID || ev.id}>
                  {(ev.Title || ev.title)} - {formatDate(ev.EventDate || ev.eventDate)} {formatTime(ev.EventTime || ev.eventTime)} - capacity: {(ev.Capacity || ev.capacity || "N/A")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 items-center">
            <button type="submit" className="cta px-5 py-2">Register</button>
            <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>

          {msg && <p className="text-sm text-[var(--brand-strong)] mt-2">{msg}</p>}
        </form>
      </div>
    </main>
  );
}