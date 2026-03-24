"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const FALLBACK_EVENTS = [
  {
    EventID: 101,
    Title: "DevHack 2026",
    Organizer: "ACM Student Chapter",
    EventDate: "2026-04-10",
    Venue: "CS Lab 1",
    Status: "Published",
  },
  {
    EventID: 102,
    Title: "Basketball Trials",
    Organizer: "FAST Sports Board",
    EventDate: "2026-04-14",
    Venue: "Main Court",
    Status: "Published",
  },
  {
    EventID: 103,
    Title: "Data Science Summit",
    Organizer: "FAST Innovation Club",
    EventDate: "2026-04-19",
    Venue: "Auditorium",
    Status: "Completed",
  },
];

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/events`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
          setEvents(FALLBACK_EVENTS);
          setNotice("Using mock events because events API response is unavailable.");
          return;
        }

        const normalized = data.map((e) => ({
          EventID: e.EventID,
          Title: e.Title,
          Organizer: e.Organizer || "Unknown Organizer",
          EventDate: e.EventDate,
          Venue: e.Venue,
          Status: e.Status || "Published",
        }));
        setEvents(normalized);
      } catch (_err) {
        setEvents(FALLBACK_EVENTS);
        setNotice("Using mock events due to API connectivity issues.");
      }
    };

    loadEvents();
  }, []);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return events.filter((item) => {
      const matchesText =
        !text ||
        [item.Title, item.Organizer, item.Venue].some((value) =>
          String(value || "").toLowerCase().includes(text)
        );
      const matchesStatus = statusFilter === "All" || String(item.Status || "") === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [events, search, statusFilter]);

  const handleCancelEvent = (eventRow) => {
    const ok = window.confirm(`Cancel event: ${eventRow.Title}?`);
    if (!ok) return;
    window.alert("Cancel flow is UI-ready. Connect this to PUT /api/admin/cancel-event later.");
  };

  return (
    <main className="glass reveal-up rounded-2xl p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-bold">Global Event Management</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, organizer, venue"
            className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="Published">Published</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Completed">Completed</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </div>

      {notice && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Organizer</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Venue</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.EventID} className="border-b border-slate-100 last:border-none">
                <td className="px-2 py-3 font-medium">{item.Title}</td>
                <td className="px-2 py-3">{item.Organizer}</td>
                <td className="px-2 py-3">{item.EventDate ? new Date(item.EventDate).toLocaleDateString() : "-"}</td>
                <td className="px-2 py-3">{item.Venue || "-"}</td>
                <td className="px-2 py-3">{item.Status}</td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => handleCancelEvent(item)}
                    className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Cancel Event
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
