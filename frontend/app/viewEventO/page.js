"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DEFAULT_EVENT_POSTER = "/images/default-event-poster.png";
const DEFAULT_ORGANIZER_LOGO = "/images/default-organizer-logo.png";

export default function ViewEventOrg() {
  const search = useSearchParams();
  const router = useRouter();
  const eventId = search.get("eventId");
  const returnTo = search.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboardO";
  const [eventData, setEventData] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [message, setMessage] = useState("");
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("orgId") || "")
    : "";

  function formatDate(value) {
    if (!value) return "TBA";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }

  function formatTime(value) {
    if (!value) return "TBA";
    const raw = String(value);

    const plainTime = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
    if (plainTime) {
      const h = Number(plainTime[1]);
      const m = Number(plainTime[2]);
      if (h <= 23 && m <= 59) {
        return new Date(1970, 0, 1, h, m).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    const isoTime = raw.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
    if (isoTime) {
      return new Date(1970, 0, 1, Number(isoTime[1]), Number(isoTime[2])).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;
      try {
        setMessage("");
        const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data) {
          throw new Error(data?.message || "Failed to load event");
        }

        setEventData(data);
      } catch (err) {
        setEventData(null);
        setMessage(err?.message || "Could not load event.");
      }
    };

    const loadRegistrations = async () => {
      if (!eventId) return;
      if (!Number.isInteger(Number(userId))) {
        setRegistrations([]);
        return;
      }

      try {
        setLoadingRegistrations(true);
        const res = await fetch(`${API_BASE_URL}/api/organizer/registrations/${encodeURIComponent(eventId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        });

        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(data?.message || `Failed to load registrations (${res.status})`);
        }

        setRegistrations(Array.isArray(data) ? data : []);
      } catch (err) {
        setRegistrations([]);
        setMessage(err?.message || "Could not load registrations.");
      } finally {
        setLoadingRegistrations(false);
      }
    };

    const loadTeams = async () => {
      if (!eventId) return;
      if (!Number.isInteger(Number(userId))) {
        setTeams([]);
        return;
      }

      try {
        setLoadingTeams(true);
        const res = await fetch(`${API_BASE_URL}/api/teams/event/${encodeURIComponent(eventId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || `Failed to load teams (${res.status})`);
        }

        setTeams(Array.isArray(data?.teams) ? data.teams : []);
      } catch (err) {
        setTeams([]);
        setMessage(err?.message || "Could not load teams.");
      } finally {
        setLoadingTeams(false);
      }
    };

    loadEvent();
    loadRegistrations();
    loadTeams();
  }, [eventId, userId]);

  if (!eventId) return <main className="min-h-screen shell"><div className="p-6">No event specified.</div></main>;
  if (!eventData) return <main className="min-h-screen shell"><div className="p-6">Event not found.</div></main>;

  const capacity = Number(eventData.Capacity ?? eventData.capacity ?? 0);
  const confirmed = Number(eventData.ConfirmedRegistrations ?? 0);
  const seatsLeft = capacity > 0 ? Math.max(capacity - confirmed, 0) : null;
  const organizerName = eventData.Organizer || "Organization";
  const organizerEmail = eventData.OrganizerEmail || eventData.OrganizerAccountEmail || "Not shared";
  const organizerDescription = eventData.OrganizerDescription || "No organizer description available.";
  const organizerLogo = eventData.OrganizerLogo || DEFAULT_ORGANIZER_LOGO;
  const posterSrc = eventData.PosterURL || DEFAULT_EVENT_POSTER;

  async function handleDelete() {
    if (!confirm("Delete this event?")) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}?organizerId=${encodeURIComponent(userId || "")}`,
        { method: "DELETE" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Delete failed");
      }
      router.push(safeReturnTo);
    } catch (err) {
      setMessage(err?.message || "Delete failed.");
    }
  }

  async function handleCancelEvent() {
    if (!confirm("Cancel this event? It will remain visible but marked as Cancelled.")) return;

    try {
      setMessage("");
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Cancel failed");
      }

      setEventData((prev) => ({ ...(prev || {}), Status: "Cancelled", status: "Cancelled" }));
      setMessage(payload?.message || "Event cancelled successfully.");
    } catch (err) {
      setMessage(err?.message || "Cancel failed.");
    }
  }

  async function handleRestoreEvent() {
    if (!confirm("Restore this cancelled event?")) return;

    try {
      setMessage("");
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/restore`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Restore failed");
      }

      setEventData((prev) => ({ ...(prev || {}), Status: "Published", status: "Published" }));
      setMessage(payload?.message || "Event restored successfully.");
    } catch (err) {
      setMessage(err?.message || "Restore failed.");
    }
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card overflow-hidden p-0 max-w-6xl mx-auto">
        <div className="relative h-56 w-full overflow-hidden border-b border-[var(--stroke)] bg-slate-100 md:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterSrc} alt="Event poster" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Organizer Event</p>
              <h1 className="text-2xl font-extrabold md:text-3xl">{eventData.title || eventData.Title}</h1>
              <p className="text-sm opacity-90">{eventData.eventType || eventData.EventType || "Event"}</p>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              {eventData.Status || eventData.status || "Draft"}
            </span>
          </div>
        </div>

        <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-white rounded shadow-sm text-center w-44">
            <Link href={safeReturnTo} className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>

        {message && <p className="mb-3 text-sm text-slate-700">{message}</p>}

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Event Details</h2>
            <p className="text-sm"><strong>Date:</strong> {formatDate(eventData.eventDate || eventData.EventDate)}</p>
            <p className="text-sm"><strong>Time:</strong> {formatTime(eventData.eventTime || eventData.EventTime || eventData.Time)}</p>
            <p className="text-sm"><strong>Venue:</strong> {eventData.venue || eventData.Venue || "TBA"}</p>
            <p className="text-sm"><strong>Registration Deadline:</strong> {formatDate(eventData.RegistrationDeadline)}</p>
            <p className="text-sm"><strong>Capacity:</strong> {capacity || "Unlimited"}</p>
            <p className="text-sm"><strong>Confirmed:</strong> {confirmed}</p>
            <p className="text-sm"><strong>Seats Left:</strong> {seatsLeft === null ? "Unlimited" : seatsLeft}</p>
            <p className="mt-3 text-sm">{eventData.description || eventData.Description || ""}</p>

            <div className="mt-4 rounded-xl border border-[var(--stroke)] bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-900">Organizer</h3>
              <div className="mt-2 flex items-start gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border border-[var(--stroke)] bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={organizerLogo} alt="Organizer logo" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{organizerName}</p>
                  <p className="text-xs text-slate-500">{organizerEmail}</p>
                  <p className="mt-1 text-xs text-slate-600">{organizerDescription}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[var(--surface-soft)] rounded md:col-span-2">
            <div className="flex gap-2 mb-3">
              <Link href={`/event/edit/${eventId}?returnTo=${encodeURIComponent(safeReturnTo)}`} className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold">Edit</Link>
              <Link href={`/attendanceO?eventId=${encodeURIComponent(eventId)}`} className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold">Attendance</Link>
              {(eventData.Status || eventData.status || "").toLowerCase() === "cancelled" ? (
                <button onClick={handleRestoreEvent} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Restore Event</button>
              ) : (
                <button onClick={handleCancelEvent} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Cancel Event</button>
              )}
              <button onClick={handleDelete} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Delete</button>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">Registered Students</h3>
              {loadingRegistrations ? (
                <p className="text-sm text-slate-600">Loading registrations...</p>
              ) : registrations.length === 0 ? (
                <p className="text-sm text-slate-600">No registrations yet.</p>
              ) : (
                <div className="overflow-auto rounded-md border border-[var(--stroke)] bg-white">
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
            </div>

            {(eventData.eventType || eventData.EventType || "").toLowerCase() === "competition" && (
              <div className="mt-6">
                <h3 className="mb-2 text-lg font-semibold">Teams Created</h3>
                {loadingTeams ? (
                  <p className="text-sm text-slate-600">Loading teams...</p>
                ) : teams.length === 0 ? (
                  <p className="text-sm text-slate-600">No teams created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div key={team.teamId} className="rounded-xl border border-[var(--stroke)] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{team.teamName}</p>
                            <p className="text-xs text-slate-600">Leader: {team.leaderName || "Unknown"}</p>
                          </div>
                          <span className="rounded-full bg-[var(--brand)]/10 px-2 py-1 text-xs font-semibold text-[var(--brand)]">
                            {team.members?.length || 0} members
                          </span>
                        </div>

                        <div className="mt-3 overflow-auto rounded-md border border-[var(--stroke)]">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                                <th className="px-3 py-2">Member</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(team.members || []).map((member) => (
                                <tr key={`${team.teamId}-${member.userId}`} className="border-b border-slate-100 last:border-none">
                                  <td className="px-3 py-2">
                                    {member.name || "Unknown"} {member.isLeader ? "(Leader)" : ""}
                                  </td>
                                  <td className="px-3 py-2">{member.email || "-"}</td>
                                  <td className="px-3 py-2">{member.status || "Pending"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}