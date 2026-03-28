"use client";
import { useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
  const [isLoading, setIsLoading] = useState(false);

  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || "anonymous")
    : "anonymous";

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(s => ({ ...s, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // required fields per schema: Title, EventDate
    if (!form.title || !form.eventDate) {
      setMsg("Fill required fields: Title and Date at minimum.");
      return;
    }

    setIsLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (userId && userId !== 'anonymous') {
        headers['x-user-id'] = userId;
      }

      const response = await fetch(`${API_BASE_URL}/api/events/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          eventType: form.eventType,
          eventDate: form.eventDate,
          eventTime: form.eventTime,
          venue: form.venue,
          capacity: parseInt(form.capacity, 10) || 0,
          registrationDeadline: form.registrationDeadline,
          posterURL: form.posterURL,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      setMsg(`✓ Event request submitted! Request ID: ${data.requestId}. Admin will review and approve.`);
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
    } catch (err) {
      setMsg(`✗ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
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
            <button type="submit" disabled={isLoading} className="cta px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
            <div className="ml-4 w-44 shrink-0">
              <div className="p-3 bg-white rounded shadow-sm text-center">
                <Link href="/dashboard" className="inline-block text-sm text-slate-600 hover:underline">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>

          {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        </form>
      </div>
    </main>
  );
}