"use client";
import { useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function EventOCreate() {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("Competition");
  const [capacity, setCapacity] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("orgId") || "")
    : "";
  const userRole = typeof window !== "undefined"
    ? String(sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || "").trim().toLowerCase()
    : "";

  async function handleSubmit(e) {
    e.preventDefault();

    // Only block when role is explicitly known and not organizer.
    // If role is missing in localStorage, allow backend to validate organizer profile.
    if (userRole && userRole !== "organizer") {
      setMessage("Only organizer accounts can add events. Please login as organizer.");
      return;
    }

    const organizerId = Number(userId);
    if (!Number.isInteger(organizerId) || organizerId <= 0) {
      setMessage("Please login again as organizer.");
      return;
    }

    const payload = {
      organizerId,
      title,
      eventDate,
      eventTime,
      venue,
      description,
      eventType,
      capacity: Number(capacity) || 0,
      status: "Published",
    };

    setIsSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to add event");
      }

      setMessage("Event created successfully.");
      setTimeout(() => {
        window.location.href = "/dashboardO";
      }, 400);
    } catch (err) {
      setMessage(err?.message || "Could not create event.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Create Event (Organizer)</h1>
            <p className="text-sm text-slate-600">Add a new event as an organizer.</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm text-center w-44">
            <Link href="/dashboardO" className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-2 border rounded" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Date</label>
              <input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Time</label>
              <input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className="w-full p-2 border rounded" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Venue</label>
            <input value={venue} onChange={e=>setVenue(e.target.value)} className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium">Event Type</label>
            <select value={eventType} onChange={e=>setEventType(e.target.value)} className="w-full p-2 border rounded">
              <option>Competition</option>
              <option>Workshop</option>
              <option>Seminar</option>
              <option>Cultural</option>
              <option>Sports</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Capacity</label>
            <input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)} className="w-full p-2 border rounded" required />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full p-2 border rounded" />
          </div>

          <div className="flex gap-3 items-center">
            <button type="submit" className="cta px-5 py-2" disabled={isSaving}>{isSaving ? "Saving..." : "Save Event"}</button>
            <Link href="/dashboardO" className="text-sm text-slate-600 hover:underline">Cancel</Link>
          </div>

          {message && <p className="text-sm text-slate-700">{message}</p>}
        </form>
      </div>
    </main>
  );
}