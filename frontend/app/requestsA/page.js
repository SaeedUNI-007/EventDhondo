"use client";
import { useEffect, useState } from "react";

export default function RequestsAdmin() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const all = JSON.parse(localStorage.getItem("eventRequests") || "[]");
    setRequests(all);
  }, []);

  function updateRequest(id, changes) {
    const key = "eventRequests";
    const all = JSON.parse(localStorage.getItem(key) || "[]");
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...changes };
    localStorage.setItem(key, JSON.stringify(all));
    setRequests(all);

    // If approved create an event in local storage events array
    if (changes.status === "Approved") {
      const eventsKey = "events";
      const events = JSON.parse(localStorage.getItem(eventsKey) || "[]");
      const r = all[idx];
      events.push({
        id: Date.now(),
        organizerId: r.userId,
        title: r.title,
        description: r.description,
        eventType: r.eventType,
        eventDate: r.eventDate,
        eventTime: r.eventTime,
        venue: r.venue,
        capacity: r.capacity,
        registrationDeadline: r.registrationDeadline,
        posterURL: r.posterURL,
        status: "Published",
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(eventsKey, JSON.stringify(events));
    }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">Admin — Event Requests</h1>
        <p className="text-sm text-slate-600 mb-4">Approve or reject incoming event creation requests.</p>

        {requests.length === 0 && <p className="text-sm">No requests.</p>}

        {requests.map(r => (
          <div key={r.id} className="border rounded p-3 mb-3">
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold">{r.title} <span className="text-sm text-slate-500">by {r.userId}</span></h3>
                <p className="text-sm text-slate-600">{r.eventType} • {r.eventDate} {r.eventTime} • {r.venue}</p>
                <p className="mt-2 text-sm">{r.description}</p>
                {r.adminNotes && <p className="mt-2 text-sm text-slate-700">Notes: {r.adminNotes}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <span className={
                  r.status === "Pending" ? "text-yellow-600" :
                  r.status === "Approved" ? "text-green-600" : "text-red-600"
                }>{r.status}</span>

                {r.status === "Pending" && (
                  <>
                    <button onClick={() => updateRequest(r.id, { status: "Approved", adminNotes: "Approved by admin." })} className="px-3 py-1 bg-green-600 text-white rounded">Approve</button>
                    <button onClick={() => {
                      const note = prompt("Optional rejection note for user:", "Rejected due to ...");
                      updateRequest(r.id, { status: "Rejected", adminNotes: note || "Rejected by admin." });
                    }} className="px-3 py-1 bg-red-600 text-white rounded">Reject</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}