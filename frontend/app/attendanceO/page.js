"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AttendanceOPage() {
  const search = useSearchParams();
  const preselectedEventId = search.get("eventId") || "";

  const userId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("userID") ||
        sessionStorage.getItem("userId") ||
        localStorage.getItem("userID") ||
        localStorage.getItem("userId") ||
        ""
      : "";

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId);
  const [registrations, setRegistrations] = useState([]);
  const [qrCode, setQrCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingRegs, setIsLoadingRegs] = useState(false);
  const [message, setMessage] = useState("");

  const resolveOrganizerId = async () => {
    if (Number.isInteger(Number(userId)) && Number(userId) > 0) {
      return String(Number(userId));
    }

    const storedEmail = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "";
    if (!storedEmail) return "";

    const res = await fetch(`${API_BASE_URL}/api/users?email=${encodeURIComponent(storedEmail)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || "Could not resolve organizer account");
    }

    const resolved = String(data?.userId || data?.id || "");
    if (!Number.isInteger(Number(resolved)) || Number(resolved) <= 0) {
      throw new Error("Could not resolve a valid organizer user ID");
    }

    sessionStorage.setItem("userID", resolved);
    sessionStorage.setItem("userId", resolved);
    localStorage.setItem("userID", resolved);
    localStorage.setItem("userId", resolved);
    return resolved;
  };

  useEffect(() => {
    const loadEvents = async () => {
      let organizerId = userId;
      if (!Number.isInteger(Number(organizerId))) {
        try {
          organizerId = await resolveOrganizerId();
        } catch (_err) {
          return;
        }
      }

      if (!Number.isInteger(Number(organizerId))) return;

      try {
        setIsLoadingEvents(true);
        setMessage("");
        const res = await fetch(`${API_BASE_URL}/api/events?organizerId=${encodeURIComponent(organizerId)}`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Failed to load events");

        const list = Array.isArray(data) ? data : [];
        setEvents(list);

        if (!selectedEventId && list.length > 0) {
          setSelectedEventId(String(list[0].EventID || list[0].eventId || ""));
        }
      } catch (err) {
        setEvents([]);
        setMessage(err?.message || "Could not load organizer events.");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    loadEvents();
  }, [selectedEventId, userId]);

  useEffect(() => {
    const loadRegistrations = async () => {
      let organizerId = userId;
      if (!Number.isInteger(Number(organizerId))) {
        try {
          organizerId = await resolveOrganizerId();
        } catch (_err) {
          setRegistrations([]);
          return;
        }
      }

      if (!selectedEventId || !Number.isInteger(Number(organizerId))) {
        setRegistrations([]);
        return;
      }

      try {
        setIsLoadingRegs(true);
        const res = await fetch(`${API_BASE_URL}/api/organizer/registrations/${encodeURIComponent(selectedEventId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(organizerId),
          },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Failed to load registrations");
        setRegistrations(Array.isArray(data) ? data : []);
      } catch (err) {
        setRegistrations([]);
        setMessage(err?.message || "Could not load registrations.");
      } finally {
        setIsLoadingRegs(false);
      }
    };

    loadRegistrations();
  }, [selectedEventId, userId]);

  const selectedEventTitle = useMemo(() => {
    const row = events.find((e) => String(e.EventID || e.eventId) === String(selectedEventId));
    return row?.Title || row?.title || "Selected Event";
  }, [events, selectedEventId]);

  const handleCheckIn = async (overrideCode) => {
    const code = typeof overrideCode === "string"
      ? overrideCode.trim()
      : String(qrCode || "").trim();
    if (!code) {
      setMessage("Please paste a QR code.");
      return;
    }

    if (!selectedEventId || !Number.isInteger(Number(selectedEventId))) {
      setMessage("Please select an event first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      const userIdMatch = String(code)
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
        .match(/EDUQR\W*(\d+)\W*/i);
      const parsedQrUserId = Number(userIdMatch?.[1]);
      const payload = {
        qrCode: code,
        eventId: String(Number(selectedEventId)),
      };
      if (Number.isInteger(parsedQrUserId) && parsedQrUserId > 0) {
        payload.qrUserId = String(parsedQrUserId);
      }

      const res = await fetch(`${API_BASE_URL}/api/events/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_err) {
        data = { message: raw || "Check-in failed" };
      }

      if (!res.ok) throw new Error(data?.message || "Check-in failed");

      setMessage(data?.message || "Attendance marked!");
      setQrCode("");

      try {
        const organizerId = Number.isInteger(Number(userId)) ? String(Number(userId)) : await resolveOrganizerId();
        if (organizerId) {
          const regRes = await fetch(`${API_BASE_URL}/api/organizer/registrations/${encodeURIComponent(selectedEventId)}`, {
            headers: {
              "Content-Type": "application/json",
              "x-user-id": String(organizerId),
            },
          });
          const regData = await regRes.json().catch(() => []);
          if (regRes.ok) setRegistrations(Array.isArray(regData) ? regData : []);
        }
      } catch (_err) {
        // Do not overwrite a successful attendance result if the snapshot refresh fails.
      }
    } catch (err) {
      setMessage(err?.message || "Could not mark attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen shell">
      <div className="surface-card max-w-6xl mx-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Organizer Attendance</p>
            <h1 className="text-2xl font-extrabold text-slate-900">QR Check-In</h1>
          </div>
          <Link href="/dashboardO" className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <section className="md:col-span-1 rounded-xl border border-[var(--stroke)] bg-[var(--surface-soft)] p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-800">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
              disabled={isLoadingEvents}
            >
              {events.map((ev) => (
                <option key={ev.EventID || ev.eventId} value={String(ev.EventID || ev.eventId)}>
                  {ev.Title || ev.title}
                </option>
              ))}
            </select>
            {isLoadingEvents && <p className="mt-2 text-xs text-slate-500">Loading events...</p>}

            <div className="mt-4 rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Current Event</p>
              <p className="text-sm font-semibold text-slate-900">{selectedEventTitle}</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Scan / Enter QR Code</label>
              <input
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheckIn();
                  }
                }}
                placeholder="Paste QR token"
                className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleCheckIn()}
                disabled={isSubmitting || !qrCode.trim()}
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Checking in..." : "Mark Attendance"}
              </button>
            </div>

            {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
          </section>

          <section className="md:col-span-2 rounded-xl border border-[var(--stroke)] bg-white p-4">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Registrations Snapshot</h2>
            {isLoadingRegs ? (
              <p className="text-sm text-slate-600">Loading registrations...</p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-slate-600">No registrations found for this event.</p>
            ) : (
              <div className="overflow-auto rounded-md border border-[var(--stroke)]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((row) => {
                      const displayName = `${row.FirstName || ""} ${row.LastName || ""}`.trim() || "Student";
                      return (
                        <tr key={row.RegistrationID || `${row.UserID}-${row.EventID}`} className="border-b border-slate-100 last:border-none">
                          <td className="px-3 py-2">{displayName}</td>
                          <td className="px-3 py-2">{row.Email || "-"}</td>
                          <td className="px-3 py-2">{row.Status || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
