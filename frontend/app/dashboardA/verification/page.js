"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const PENDING_ENDPOINTS = [
  "/api/admin/pending-organizers",
  "/api/admin/pending-organizer",
  "/api/admin/organizer-requests",
];

export default function OrganizerVerificationPage() {
  const [organizers, setOrganizers] = useState([]);
  const [status, setStatus] = useState("");
  const [loadingById, setLoadingById] = useState({});

  useEffect(() => {
    const loadPending = async () => {
      try {
        setStatus("");
        const userId = typeof window !== 'undefined'
          ? (sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId'))
          : null;

        const headers = { 'Content-Type': 'application/json' };
        if (userId) {
          headers['x-user-id'] = userId;
        }

        let lastError = "";
        let data = [];
        let loaded = false;

        for (const endpoint of PENDING_ENDPOINTS) {
          const pendingRes = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
          if (pendingRes.ok) {
            data = await pendingRes.json();
            loaded = true;
            break;
          }

          const payload = await pendingRes.json().catch(() => ({}));
          lastError = payload?.message || `Status ${pendingRes.status}`;

          if (pendingRes.status !== 404) {
            break;
          }
        }

        if (!loaded) {
          setOrganizers([]);
          setStatus(`Failed to load pending organizers: ${lastError || "endpoint not found"}`);
          return;
        }

        const pendingRows = (Array.isArray(data) ? data : []).map((row) => ({
          UserID: row.UserID,
          OrganizationName: row.OrganizationName,
          ContactEmail: row.ContactEmail,
          Description: row.Description,
          RequestedDate: row.RequestedDate,
        }));
        setOrganizers(pendingRows);
      } catch (_err) {
        setOrganizers([]);
        setStatus("Failed to load pending organizers: " + _err.message);
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
      const userId = typeof window !== 'undefined'
        ? (sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId'))
        : null;

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
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || `Approve failed (${res.status})`);
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

      const userId = typeof window !== 'undefined'
        ? (sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId'))
        : null;

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
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || `Reject failed (${res.status})`);
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
