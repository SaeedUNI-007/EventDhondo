"use client";
import { useState } from "react";
import Link from "next/link";

export default function EventRequestPage() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    eventType: "Workshop",
    eventDate: "",
    eventTime: "",
    venue: "",
    capacity: "",
    registrationDeadline: "",
    posterURL: "",
  });
  const [msg, setMsg] = useState("");

  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || "anonymous")
    : "anonymous";
  const role = typeof window !== "undefined"
    ? (sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || "organizer")
    : "organizer";

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(s => ({ ...s, [name]: value }));
  }

  function persistRequest(request) {
    const key = "eventRequests";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push(request);
    localStorage.setItem(key, JSON.stringify(existing));

    const notesKey = "adminNotifications";
    const notes = JSON.parse(localStorage.getItem(notesKey) || "[]");
    notes.push({
      id: Date.now(),
      type: "EventCreationRequest",
      title: request.title,
      from: request.organizerId,
      time: new Date().toISOString(),
      requestId: request.id
    });
    localStorage.setItem(notesKey, JSON.stringify(notes));
  }

  function handleSubmit(e) {
    e.preventDefault();

    // required fields per schema: Title, EventType, EventDate, EventTime, Capacity, RegistrationDeadline
    if (!form.title || !form.eventType || !form.eventDate || !form.eventTime || !form.capacity || !form.registrationDeadline) {
      setMsg("Fill required fields: Title, Type, Date, Time, Capacity, Registration deadline.");
      return;
    }

    const request = {
      id: Date.now(),
      organizerId: userId,
      organizerRole: role,
      title: form.title,
      description: form.description,
      eventType: form.eventType,
      eventDate: form.eventDate,
      eventTime: form.eventTime,
      venue: form.venue,
      capacity: parseInt(form.capacity, 10) || 0,
      registrationDeadline: form.registrationDeadline,
      posterURL: form.posterURL,
      status: "Pending",
      submittedAt: new Date().toISOString(),
      adminNotes: ""
    };

    persistRequest(request);
    setMsg("Request submitted — sent to admin requests portal for approval.");
    setForm({
      title: "",
      description: "",
      eventType: "Workshop",
      eventDate: "",
      eventTime: "",
      venue: "",
      capacity: "",
      registrationDeadline: "",
      posterURL: "",
    });
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">Submit Event for Admin Approval</h1>
        <p className="text-sm text-slate-600 mb-4">Provide event details. Admin will review and approve before publishing.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Title *</label>
            <input name="title" value={form.title} onChange={handleChange} className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} className="w-full p-2 border rounded" rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Event Type *</label>
              <select name="eventType" value={form.eventType} onChange={handleChange} className="w-full p-2 border rounded">
                <option>Competition</option>
                <option>Workshop</option>
                <option>Seminar</option>
                <option>Cultural</option>
                <option>Sports</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Venue</label>
              <input name="venue" value={form.venue} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium">Date *</label>
              <input type="date" name="eventDate" value={form.eventDate} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Time *</label>
              <input type="time" name="eventTime" value={form.eventTime} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Capacity *</label>
              <input type="number" min="1" name="capacity" value={form.capacity} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Registration Deadline *</label>
            <input type="datetime-local" name="registrationDeadline" value={form.registrationDeadline} onChange={handleChange} className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium">Poster URL</label>
            <input name="posterURL" value={form.posterURL} onChange={handleChange} className="w-full p-2 border rounded" />
          </div>

          <div className="flex gap-3 items-center">
            <button type="submit" className="cta px-5 py-2">Submit Request</button>
            <div className="ml-4 w-44 shrink-0">
              <div className="p-3 bg-white rounded shadow-sm text-center">
                <Link href="/dashboard" className="inline-block text-sm text-slate-600 hover:underline">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>

          {msg && <p className="text-sm text-[var(--brand-strong)]">{msg}</p>}
        </form>
      </div>
    </main>
  );
}