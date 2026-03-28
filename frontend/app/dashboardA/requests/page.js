"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const FALLBACK_REQUESTS = [
  {
    RequestID: 501,
    StudentID: 77,
    Title: "Photography Masterclass",
    Description: "Hands-on DSLR and mobile photography workshop.",
    SuggestedDate: "2026-04-16",
    Status: "Pending",
  },
  {
    RequestID: 502,
    StudentID: 84,
    Title: "System Design Bootcamp",
    Description: "Two-day practical session on scalable system architecture.",
    SuggestedDate: "2026-04-21",
    Status: "Pending",
  },
];

export default function StudentRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [loadingById, setLoadingById] = useState({});

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;

        const headers = { 'Content-Type': 'application/json' };
        if (userId) {
          headers['x-user-id'] = userId;
        }

        const res = await fetch(`${API_BASE_URL}/api/admin/requests`, { headers });
        if (!res.ok) {
          setRequests(FALLBACK_REQUESTS);
          setNotice("Using mock student requests because admin requests endpoint returned: " + res.status);
          return;
        }

        const data = await res.json();
        setRequests(Array.isArray(data) ? data : FALLBACK_REQUESTS);
      } catch (_err) {
        setRequests(FALLBACK_REQUESTS);
        setNotice("Using mock student requests due to API connectivity issues: " + _err.message);
      }
    };

    loadRequests();
  }, []);

  const handleApprove = async (requestId) => {
    if (!window.confirm('Approve this event request? This will create a draft event.')) return;

    setLoadingById((prev) => ({ ...prev, [requestId]: true }));
    try {
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;
      const headers = { 'Content-Type': 'application/json' };
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`${API_BASE_URL}/api/admin/event-request/${encodeURIComponent(requestId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'Approved', adminNotes: 'Approved from admin dashboard' }),
      });

      if (!res.ok) throw new Error(`Approve failed: ${res.status}`);

      setRequests((prev) => prev.filter((item) => Number(item.RequestID) !== Number(requestId)));
      setNotice('Event request approved! Draft event created.');
    } catch (err) {
      setNotice('Approve failed: ' + err.message);
    } finally {
      setLoadingById((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;

    setLoadingById((prev) => ({ ...prev, [requestId]: true }));
    try {
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;
      const headers = { 'Content-Type': 'application/json' };
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`${API_BASE_URL}/api/admin/event-request/${encodeURIComponent(requestId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'Rejected', adminNotes: reason }),
      });

      if (!res.ok) throw new Error(`Reject failed: ${res.status}`);

      setRequests((prev) => prev.filter((item) => Number(item.RequestID) !== Number(requestId)));
      setNotice('Event request rejected.');
    } catch (err) {
      setNotice('Reject failed: ' + err.message);
    } finally {
      setLoadingById((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  return (
    <main className="glass reveal-up rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Student Event Suggestions</h3>
        <span className="text-sm text-slate-500">{requests.length} requests</span>
      </div>

      {notice && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p>}

      <div className="space-y-3">
        {requests.map((row) => (
          <article key={row.RequestID} className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">{row.Title}</h4>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-slate-600">{row.Status || "Pending"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{row.Description}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-500">
              <div><strong>Student:</strong> {row.StudentName || `ID: ${row.StudentID}`} ({row.StudentEmail})</div>
              <div><strong>Suggested Date:</strong> {row.SuggestedDate || "-"}</div>
              <div><strong>Submitted:</strong> {row.SubmittedAt || "-"}</div>
              {row.AdminNotes && <div><strong>Admin Notes:</strong> {row.AdminNotes}</div>}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleApprove(row.RequestID)}
                disabled={loadingById[row.RequestID]}
                className="cta px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingById[row.RequestID] ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(row.RequestID)}
                disabled={loadingById[row.RequestID]}
                className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingById[row.RequestID] ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
