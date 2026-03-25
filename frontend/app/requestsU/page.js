"use client";
import { useMemo } from "react";
import Link from "next/link";

export default function RequestsUser() {
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";

  const pending = useMemo(() => {
    if (typeof window === "undefined") return [];
    const all = JSON.parse(localStorage.getItem("eventRequests") || "[]");
    // Event request form currently stores requester in organizerId.
    return all.filter(
      (r) => String(r.organizerId || r.userId) === String(userId) && String(r.status || "Pending").toLowerCase() === "pending"
    );
  }, [userId]);

  function titleForEvent(r) {
    return r.title || r.eventTitle || `Request ${r.id}`;
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Your Pending Event Requests</h1>
            <p className="text-sm text-slate-600">Requests you submitted that are awaiting admin review.</p>
          </div>
          <div>
            <Link href="/dashboard" className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-[var(--surface-soft)]">
              Back to Dashboard
            </Link>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="p-6 bg-white rounded text-slate-600">
            No pending requests. Use the Dashboard to create requests or check earlier submissions in Admin portal.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r.id} className="border rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{titleForEvent(r)}</h3>
                    <p className="text-sm text-slate-600">{r.eventType || r.event_Type || "Event"}</p>
                  </div>
                  <div className="text-sm font-medium">
                    <span className="text-yellow-600">Pending</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div>
                    <p><strong>Date:</strong> {r.eventDate || r.date || "TBA"}</p>
                    <p><strong>Time:</strong> {r.eventTime || r.time || "TBA"}</p>
                    <p><strong>Venue:</strong> {r.venue || "TBA"}</p>
                  </div>
                  <div>
                    <p><strong>Capacity:</strong> {r.capacity ?? r.seats ?? "N/A"}</p>
                    <p><strong>Registration deadline:</strong> {r.registrationDeadline || r.regDeadline || "N/A"}</p>
                    <p><strong>Submitted:</strong> {new Date(r.submittedAt || r.createdAt || r.id).toLocaleString()}</p>
                  </div>
                </div>

                {r.description && <p className="mt-3 text-sm text-slate-700">{r.description}</p>}

                {r.adminNotes && <p className="mt-2 text-sm text-slate-600">Admin note: {r.adminNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}