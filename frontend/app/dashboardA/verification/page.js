"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const FALLBACK_PENDING_ORGANIZERS = [
  {
    UserID: 32,
    OrganizationName: "FAST Innovation Club",
    ContactEmail: "innovation@fast.edu.pk",
    Description: "Student-led innovation and startup events.",
    RequestedDate: "2026-03-19",
  },
  {
    UserID: 45,
    OrganizationName: "Debate and Oratory Society",
    ContactEmail: "debate@fast.edu.pk",
    Description: "Inter-campus debates and public speaking sessions.",
    RequestedDate: "2026-03-20",
  },
];

export default function OrganizerVerificationPage() {
  const [organizers, setOrganizers] = useState([]);
  const [status, setStatus] = useState("");
  const [loadingById, setLoadingById] = useState({});

  useEffect(() => {
    const loadPending = async () => {
      try {
        setStatus("");
        const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;

        const headers = { 'Content-Type': 'application/json' };
        if (userId) {
          headers['x-user-id'] = userId;
        }

        const requestsRes = await fetch(`${API_BASE_URL}/api/admin/requests`, { headers });
        if (!requestsRes.ok) {
          setOrganizers(FALLBACK_PENDING_ORGANIZERS);
          setStatus("Using mock organizers because admin requests endpoint returned: " + requestsRes.status);
          return;
        }

        const data = await requestsRes.json();
        const pendingRows = Array.isArray(data) ? data : [];
        setOrganizers(pendingRows);
      } catch (_err) {
        setOrganizers(FALLBACK_PENDING_ORGANIZERS);
        setStatus("Using mock organizers due to API connectivity issues: " + _err.message);
      }
    };

    loadPending();
  }, []);

  const hasRows = useMemo(() => organizers.length > 0, [organizers]);

  const setRowLoading = (id, value) => {
    setLoadingById((prev) => ({ ...prev, [id]: value }));
  };

  const handleApprove = async (id) => {
    setRowLoading(id, true);
    try {
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;

      const headers = { 'Content-Type': 'application/json' };
      if (userId) {
        headers['x-user-id'] = userId;
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/verify-organizer/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: 'Verified' }),
      });

      if (!res.ok) {
        throw new Error("Approve failed: " + res.status);
      }

      setOrganizers((prev) => prev.filter((item) => Number(item.UserID) !== Number(id)));
    } catch (_err) {
      setStatus("Approve failed: " + _err.message);
    } finally {
      setRowLoading(id, false);
    }
  };

  const handleReject = async (id) => {
    setRowLoading(id, true);
    try {
      const reason = prompt('Enter reason for rejection:');
      if (!reason) {
        setRowLoading(id, false);
        return;
      }

      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;

      const headers = { 'Content-Type': 'application/json' };
      if (userId) {
        headers['x-user-id'] = userId;
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/verify-organizer/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: 'Rejected', reason }),
      });

      if (!res.ok) {
        throw new Error("Reject failed: " + res.status);
      }

      setOrganizers((prev) => prev.filter((item) => Number(item.UserID) !== Number(id)));
    } catch (_err) {
      setStatus("Reject failed: " + _err.message);
    } finally {
      setRowLoading(id, false);
    }
  };

  return (
    <main className="glass reveal-up rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Pending Organizer Verification</h3>
        <span className="text-sm text-slate-500">{organizers.length} pending</span>
      </div>

      {status && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{status}</p>}

      {!hasRows ? (
        <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-slate-600">No pending organizer requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2">Society Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Requested Date</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((row) => {
                const busy = Boolean(loadingById[row.UserID]);
                return (
                  <tr key={row.UserID} className="border-b border-slate-100 last:border-none">
                    <td className="px-2 py-3 font-medium">{row.OrganizationName}</td>
                    <td className="px-2 py-3">{row.ContactEmail}</td>
                    <td className="px-2 py-3">{row.RequestedDate || "-"}</td>
                    <td className="px-2 py-3 max-w-sm text-slate-600">{row.Description || "-"}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() => handleApprove(row.UserID)}
                          className="cta px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                        >
                          {busy ? "Working..." : "Approve"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleReject(row.UserID)}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? "Working..." : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
