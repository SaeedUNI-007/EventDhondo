"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function RegisterEventPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [seats, setSeats] = useState(1);
  const [contact, setContact] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const ev = JSON.parse(localStorage.getItem("events") || "[]");
    setEvents(ev);
    if (ev.length) setSelectedEventId(String(ev[0].id));
  }, []);

  const userId = typeof window !== "undefined" ? (localStorage.getItem("userId") || "anonymous") : "anonymous";

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedEventId) {
      setMsg("Select an event to register.");
      return;
    }
    const ev = events.find(x => String(x.id) === String(selectedEventId));
    if (!ev) {
      setMsg("Selected event not found.");
      return;
    }

    const requested = parseInt(seats, 10) || 1;
    if (requested < 1) {
      setMsg("Enter at least 1 seat.");
      return;
    }

    // Build registration object (required per schema: userId, eventId)
    const registration = {
      id: Date.now(),
      eventId: ev.id,
      userId,
      seats: requested,
      contact: contact || "",
      status: "Registered",
      registeredAt: new Date().toISOString()
    };

    // Check capacity and either register or add to waitlist
    const eventsKey = "events";
    const allEvents = JSON.parse(localStorage.getItem(eventsKey) || "[]");
    const idx = allEvents.findIndex(x => x.id === ev.id);

    const registrationsKey = "registrations";
    const regs = JSON.parse(localStorage.getItem(registrationsKey) || "[]");

    // calculate already taken seats for event
    const taken = regs.filter(r => String(r.eventId) === String(ev.id) && r.status === "Registered").reduce((s, r) => s + (r.seats || 1), 0);
    const remaining = (ev.capacity || 0) - taken;

    if (remaining >= requested) {
      // register
      regs.push(registration);
      localStorage.setItem(registrationsKey, JSON.stringify(regs));

      // optional: reduce capacity value on event (keeps original capacity but for UI we rely on taken calc)
      setMsg("Registration successful. You are registered for the event.");
    } else {
      // add to waitlist
      const waitKey = "registrationWaitlist";
      const wait = JSON.parse(localStorage.getItem(waitKey) || "[]");
      wait.push({
        id: Date.now(),
        eventId: ev.id,
        userId,
        seats: requested,
        contact: contact || "",
        addedAt: new Date().toISOString()
      });
      localStorage.setItem(waitKey, JSON.stringify(wait));
      setMsg("Event is full for requested seats. You were added to the waitlist.");
    }

    // notify admin (simple local notification)
    const notesKey = "adminNotifications";
    const notes = JSON.parse(localStorage.getItem(notesKey) || "[]");
    notes.push({ id: Date.now(), type: "Registration", eventId: ev.id, from: userId, time: new Date().toISOString() });
    localStorage.setItem(notesKey, JSON.stringify(notes));

    // reset form lightly
    setSeats(1);
    setContact("");
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">Register for an Event</h1>
        <p className="text-sm text-slate-600 mb-4">Select a published event and submit registration. Required: selected event and number of seats.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Event *</label>
            <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full p-2 border rounded">
              {events.length === 0 && <option value="">No events published</option>}
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} — {ev.eventDate} {ev.eventTime} — capacity: {ev.capacity || "N/A"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Seats *</label>
              <input type="number" min="1" value={seats} onChange={e => setSeats(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Contact (email/phone)</label>
              <input value={contact} onChange={e => setContact(e.target.value)} className="w-full p-2 border rounded" />
            </div>
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