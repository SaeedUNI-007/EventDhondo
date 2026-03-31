"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AdminStudentEventsPage() {
  const returnTo = encodeURIComponent("/dashboardA/student-events");
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const load = async () => {
      try {
        setNotice("");
        const userId = typeof window !== "undefined"
          ? (sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId"))
          : null;

        const headers = { "Content-Type": "application/json" };
        if (userId) headers["x-user-id"] = String(userId);

        const res = await fetch(`${API_BASE_URL}/api/admin/student-events`, { headers });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) {
          throw new Error(data?.message || `Failed to load student events (${res.status})`);
        }

        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        setEvents([]);
        setNotice(err?.message || "Could not load student events");
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      const matchesSearch = !q || [ev.Title, ev.Description, ev.Venue, ev.Organizer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));

      const matchesStatus = statusFilter === "All" || String(ev.Status || "") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [events, search, statusFilter]);

  const cancelEvent = async (eventId) => {
    const ok = window.confirm("Cancel this student-approved event?");
    if (!ok) return;

    try {
      const userId = typeof window !== "undefined"
        ? (sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId"))
        : null;

      const headers = { "Content-Type": "application/json" };
      if (userId) headers["x-user-id"] = String(userId);

      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        headers,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || `Cancel failed (${res.status})`);
      }

      setEvents((prev) => prev.filter((x) => Number(x.EventID) !== Number(eventId)));
      setNotice("Student event cancelled.");
    } catch (err) {
      setNotice(err?.message || "Cancel failed");
    }
  };

  return (
    <main className="glass reveal-up rounded-2xl p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold">Student Approved Events</h3>
          <p className="text-sm text-slate-500">Admin-managed events created from student requests</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, venue, organizer"
            className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {notice && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Venue</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => (
              <tr key={ev.EventID} className="border-b border-slate-100 last:border-none">
                <td className="px-2 py-3 font-medium">{ev.Title}</td>
                <td className="px-2 py-3">{ev.EventDate ? new Date(ev.EventDate).toLocaleDateString() : "-"}</td>
                <td className="px-2 py-3">{ev.Venue || "-"}</td>
                <td className="px-2 py-3">{ev.Status || "-"}</td>
                <td className="px-2 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/viewEventO?eventId=${ev.EventID}&returnTo=${returnTo}`} className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold">
                      View
                    </Link>
                    <Link href={`/event/edit/${ev.EventID}?returnTo=${returnTo}`} className="cta px-3 py-1.5 text-xs font-semibold">
                      Edit
                    </Link>
                    <button
                      onClick={() => cancelEvent(ev.EventID)}
                      className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!filtered.length && <p className="mt-3 text-sm text-slate-600">No student-approved events found.</p>}
    </main>
  );
}
