"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EVENT_TYPES = ["Competition", "Workshop", "Seminar", "Cultural", "Sports"];
const EVENT_STATUSES = ["Draft", "Published", "Cancelled"];
const ALLOWED_CITIES = ['Lahore', 'Islamabad', 'Karachi'];

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateTimeLocalInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function toTimeInputValue(value) {
  if (!value) return "";
  const raw = String(value);
  const plain = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/);
  if (plain) {
    return `${String(Number(plain[1])).padStart(2, "0")}:${plain[2]}`;
  }

  const isoTime = raw.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
  if (isoTime) {
    return `${isoTime[1]}:${isoTime[2]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const eventId = params?.id;
  const returnTo = search.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboardO";

  const [form, setForm] = useState({
    title: "",
    description: "",
    eventType: "Seminar",
    eventDate: "",
    eventTime: "",
    venue: "",
    city: "Lahore",
    capacity: "",
    registrationDeadline: "",
    posterURL: "",
    status: "Draft",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";

  const posterPreview = useMemo(() => {
    return form.posterURL?.trim() || "/images/default-event-poster.png";
  }, [form.posterURL]);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;
      try {
        setLoading(true);
        setMessage("");

        const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load event details");
        }

        const eventDateRaw = data.EventDate || data.eventDate || "";
        const eventTimeRaw = data.EventTime || data.eventTime || "";
        const registrationDeadlineRaw = data.RegistrationDeadline || "";

        const formattedDate = toDateInputValue(eventDateRaw);
        const formattedTime = toTimeInputValue(eventTimeRaw);
        const formattedDeadline = toDateTimeLocalInputValue(registrationDeadlineRaw);

        setForm({
          title: data.Title || data.title || "",
          description: data.Description || data.description || "",
          eventType: data.EventType || data.eventType || "Seminar",
          eventDate: formattedDate,
          eventTime: formattedTime,
          venue: data.Venue || data.venue || "",
          city: data.City || data.city || 'Lahore',
          capacity: String(data.Capacity || data.capacity || ""),
          registrationDeadline: formattedDeadline,
          posterURL: data.PosterURL || data.posterURL || "",
          status: data.Status || data.status || "Draft",
        });
      } catch (err) {
        setMessage(err?.message || "Could not load event");
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!userId) {
      setMessage("Please login again before editing events.");
      return;
    }

    if (!form.title || !form.eventType || !form.eventDate || !form.eventTime || !form.capacity || !form.registrationDeadline) {
      setMessage("Please fill all required fields.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          eventType: form.eventType,
          eventDate: form.eventDate,
          eventTime: form.eventTime,
          venue: form.venue,
          city: form.city,
          capacity: Number(form.capacity),
          registrationDeadline: form.registrationDeadline,
          posterURL: form.posterURL || null,
          status: form.status,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to update event");
      }

      setMessage("Event updated successfully.");
      setTimeout(() => {
        router.push(`/viewEventO?eventId=${encodeURIComponent(eventId)}&returnTo=${encodeURIComponent(safeReturnTo)}`);
      }, 500);
    } catch (err) {
      setMessage(err?.message || "Event update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen shell">
        <div className="surface-card mx-auto max-w-4xl p-6">Loading event details...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card mx-auto max-w-5xl overflow-hidden p-0">
        <div className="relative h-56 w-full overflow-hidden border-b border-[var(--stroke)] bg-slate-100 md:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterPreview} alt="Poster preview" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Organizer Tools</p>
              <h1 className="text-2xl font-extrabold md:text-3xl">Edit Event</h1>
            </div>
            <Link href={`/viewEventO?eventId=${encodeURIComponent(eventId)}&returnTo=${encodeURIComponent(safeReturnTo)}`} className="rounded-full bg-white/20 px-4 py-2 text-xs font-semibold backdrop-blur">
              Back to Event
            </Link>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Title *</label>
              <input name="title" value={form.title} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Description</label>
              <textarea name="description" value={form.description} onChange={onChange} rows={6} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Poster URL</label>
              <input name="posterURL" value={form.posterURL} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" placeholder="https://..." />
              <p className="mt-1 text-xs text-slate-500">Leave empty to use /images/default-event-poster.png.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Event Type *</label>
                <select name="eventType" value={form.eventType} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2">
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Status *</label>
                <select name="status" value={form.status} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2">
                  {EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Date *</label>
                <input type="date" name="eventDate" value={form.eventDate} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Time *</label>
                <input type="time" name="eventTime" value={form.eventTime} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Venue</label>
              <input name="venue" value={form.venue} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">City *</label>
              <select name="city" value={form.city} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" required>
                {ALLOWED_CITIES.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>{cityOption}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Capacity *</label>
                <input type="number" min="1" name="capacity" value={form.capacity} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Registration Deadline *</label>
                <input type="datetime-local" name="registrationDeadline" value={form.registrationDeadline} onChange={onChange} className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2" required />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" disabled={saving} className="cta px-5 py-2 font-semibold disabled:opacity-60">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <Link href={`/viewEventO?eventId=${encodeURIComponent(eventId)}&returnTo=${encodeURIComponent(safeReturnTo)}`} className="rounded-lg border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
                Cancel
              </Link>
            </div>

            {message && <p className="text-sm text-slate-700">{message}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}
