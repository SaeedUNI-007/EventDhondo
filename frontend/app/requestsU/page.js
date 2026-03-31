"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function RequestsUser() {
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRequests = async () => {
      if (!userId || !Number.isInteger(Number(userId))) {
        setRequests([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setNotice("");
        const res = await fetch(`${API_BASE_URL}/api/events/requests/${encodeURIComponent(userId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        });

        const data = await res.json().catch(() => ([]));
        if (!res.ok) {
          throw new Error(data?.message || `Failed to load requests (${res.status})`);
        }

        setRequests(Array.isArray(data) ? data : []);
      } catch (err) {
        setRequests([]);
        setNotice(err?.message || "Could not load your requests");
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [userId]);

  const pending = requests.filter((r) => String(r.Status || r.status || "").toLowerCase() === "pending");

  function titleForEvent(r) {
    return r.Title || r.title || r.eventTitle || `Request ${r.RequestID || r.id}`;
  }

  const badgeClasses = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (normalized === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 max-w-5xl mx-auto">
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

        {notice && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p>}

        {loading && (
          <div className="p-6 bg-white rounded text-slate-600">Loading your requests...</div>
        )}

        {!loading && pending.length === 0 ? (
          <div className="p-6 bg-white rounded text-slate-600">
            No pending requests. Use the Dashboard to create requests or check earlier submissions in Admin portal.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pending.map(r => (
              <article key={r.RequestID || r.id} className="surface-card reveal-up h-full overflow-hidden p-4 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{titleForEvent(r)}</h3>
                    <p className="text-sm text-slate-600">{r.EventType || r.eventType || r.event_Type || "Event"}</p>
                  </div>
                  <div className="text-sm font-medium">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses(r.Status || r.status || "Pending")}`}>
                      {r.Status || r.status || "Pending"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <p><strong>Date:</strong> {r.SuggestedDate || r.eventDate || r.date || "TBA"}</p>
                    <p><strong>Time:</strong> {r.EventTime || r.eventTime || r.time || "TBA"}</p>
                    <p><strong>Venue:</strong> {r.Venue || r.venue || "TBA"}</p>
                  </div>
                  <div>
                    <p><strong>Capacity:</strong> {r.Capacity ?? r.capacity ?? r.seats ?? "N/A"}</p>
                    <p><strong>Registration deadline:</strong> {r.RegistrationDeadline || r.registrationDeadline || r.regDeadline || "N/A"}</p>
                    <p><strong>Submitted:</strong> {new Date(r.SubmittedAt || r.submittedAt || r.createdAt || Date.now()).toLocaleString()}</p>
                  </div>
                </div>

                {(r.Description || r.description) && <p className="mt-3 min-h-[48px] text-sm text-slate-700">{r.Description || r.description}</p>}

                {(r.AdminNotes || r.adminNotes) && <p className="mt-2 text-sm text-slate-600">Admin note: {r.AdminNotes || r.adminNotes}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}