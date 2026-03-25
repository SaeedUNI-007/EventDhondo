"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function EventOCreate() {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("Competition");
  const [capacity, setCapacity] = useState(50);
  const userId = typeof window !== "undefined" ? (localStorage.getItem("userId") || localStorage.getItem("orgId") || "org") : "org";

  function handleSubmit(e) {
    e.preventDefault();
    const ev = {
      id: Date.now(),
      title,
      eventDate,
      eventTime,
      venue,
      description,
      eventType,
      capacity: Number(capacity) || 0,
      organizerId: userId,
      status: "published",
      createdAt: new Date().toISOString()
    };
    const all = JSON.parse(localStorage.getItem("events") || "[]");
    all.push(ev);
    localStorage.setItem("events", JSON.stringify(all));
    // simple notification
    const notes = JSON.parse(localStorage.getItem("adminNotifications") || "[]");
    notes.push({ id: Date.now(), type: "NewEvent", eventId: ev.id, from: userId, time: new Date().toISOString() });
    localStorage.setItem("adminNotifications", JSON.stringify(notes));
    // navigate back
    location.href = "/dashboardO";
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
              <input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Time</label>
              <input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className="w-full p-2 border rounded" />
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
            <input type="number" value={capacity} onChange={e=>setCapacity(e.target.value)} className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full p-2 border rounded" />
          </div>

          <div className="flex gap-3 items-center">
            <button type="submit" className="cta px-5 py-2">Save Event</button>
            <Link href="/dashboardO" className="text-sm text-slate-600 hover:underline">Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}