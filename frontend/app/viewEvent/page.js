"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import CreateTeamModal from "@/components/team/CreateTeamModal";
import TeamManagementCard from "@/components/team/TeamManagementCard";
import TeamInviteAction from "@/components/team/TeamInviteAction";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DEFAULT_EVENT_POSTER = "/images/default-event-poster.png";
const DEFAULT_ORGANIZER_LOGO = "/images/default-organizer-logo.png";

export default function ViewEventPage() {
  const search = useSearchParams();
  const router = useRouter();
  const eventId = search.get("eventId");

  const [eventData, setEventData] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [teamData, setTeamData] = useState(null);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  const [reviewSummary, setReviewSummary] = useState(null);
  const [organizerReputation, setOrganizerReputation] = useState(null);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    overallRating: 5,
    organizationQualityRating: 5,
    contentQualityRating: 5,
    venueRating: 5,
    valueForTimeRating: 5,
    reviewText: "",
  });

  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || localStorage.getItem("userID") || "")
    : "";

  const userRole = typeof window !== "undefined"
    ? String(sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || "").toLowerCase()
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
    const loadEventAndStatus = async () => {
      if (!eventId) return;
      try {
        setMessage("");
        const eventRes = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`);
        const eventPayload = await eventRes.json().catch(() => ({}));
        if (!eventRes.ok) {
          throw new Error(eventPayload?.message || "Failed to load event");
        }

        setEventData(eventPayload || null);

        const numericUserId = Number(userId);
        if (Number.isInteger(numericUserId) && numericUserId > 0) {
          const regRes = await fetch(`${API_BASE_URL}/api/events/registrations/${encodeURIComponent(numericUserId)}`);
          const regData = await regRes.json().catch(() => []);

          if (regRes.ok && Array.isArray(regData)) {
            const activeRow = regData.find(
              (r) => String(r.EventID || r.eventId) === String(eventId) && String(r.Status || "").toLowerCase() !== "cancelled"
            );
            setIsRegistered(Boolean(activeRow));
          }
        }
      } catch (_err) {
        setEventData(null);
      }
    };

    loadEventAndStatus();
  }, [eventId, userId]);

  useEffect(() => {
    const loadReviewSummary = async () => {
      if (!eventId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(eventId)}/summary`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.message || "Failed to load review summary");
        setReviewSummary(payload?.summary || null);
        setOrganizerReputation(payload?.organizerReputation || null);
      } catch (_err) {
        setReviewSummary(null);
        setOrganizerReputation(null);
      }
    };

    loadReviewSummary();
  }, [eventId]);

  useEffect(() => {
    const loadEligibilityAndMine = async () => {
      const numericUserId = Number(userId);
      if (!eventId || userRole !== "student" || !Number.isInteger(numericUserId) || numericUserId <= 0) {
        setReviewEligibility(null);
        setMyReview(null);
        return;
      }

      try {
        const [eligibilityRes, mineRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(eventId)}/eligibility`, {
            headers: { "x-user-id": String(numericUserId) },
          }),
          fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(eventId)}/mine`, {
            headers: { "x-user-id": String(numericUserId) },
          }),
        ]);

        const eligibilityPayload = await eligibilityRes.json().catch(() => ({}));
        const minePayload = await mineRes.json().catch(() => ({}));

        setReviewEligibility(eligibilityRes.ok ? (eligibilityPayload?.eligibility || null) : null);
        setMyReview(mineRes.ok ? (minePayload?.review || null) : null);
      } catch (_err) {
        setReviewEligibility(null);
        setMyReview(null);
      }
    };

    loadEligibilityAndMine();
  }, [eventId, userId, userRole]);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!isRegistered || !eventId || !userId) return;

      setIsLoadingTeam(true);
      try {
        const numericUserId = Number(userId);
        const numericEventId = Number(eventId);

        const teamResponse = await fetch(
          `${API_BASE_URL}/api/teams/user/${numericUserId}?eventId=${numericEventId}`,
          { headers: { "x-user-id": String(numericUserId) } }
        );

        const inviteResponse = await fetch(
          `${API_BASE_URL}/api/teams/invites/pending/${numericUserId}?eventId=${numericEventId}`,
          { headers: { "x-user-id": String(numericUserId) } }
        );

        if (teamResponse.ok) {
          const data = await teamResponse.json();
          setTeamData(data || null);
        } else {
          setTeamData(null);
        }

        if (inviteResponse.ok) {
          const invitePayload = await inviteResponse.json();
          setPendingInvite(invitePayload?.invite || null);
        } else {
          setPendingInvite(null);
        }
      } catch (_err) {
        setTeamData(null);
        setPendingInvite(null);
      } finally {
        setIsLoadingTeam(false);
      }
    };

    fetchTeamData();
  }, [isRegistered, eventId, userId]);

  async function handleUnregister() {
    const numericUserId = Number(userId);
    const numericEventId = Number(eventId);

    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      setMessage("Please login again before unregistering.");
      return;
    }
    if (!Number.isInteger(numericEventId) || numericEventId <= 0) {
      setMessage("Invalid event id.");
      return;
    }

    setIsBusy(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/unregister`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(numericUserId),
        },
        body: JSON.stringify({ userId: numericUserId, eventId: numericEventId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.message || "Failed to unregister");
      setIsRegistered(false);
      setMessage(data?.message || "Unregistered successfully.");
    } catch (err) {
      setMessage(err?.message || "Failed to unregister.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmitReview() {
    const numericUserId = Number(userId);
    const numericEventId = Number(eventId);

    if (userRole !== "student") {
      setMessage("Only students can submit reviews.");
      return;
    }
    if (!Number.isInteger(numericUserId) || numericUserId <= 0 || !Number.isInteger(numericEventId) || numericEventId <= 0) {
      setMessage("Please login again before submitting your review.");
      return;
    }

    setIsSubmittingReview(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(numericEventId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(numericUserId),
        },
        body: JSON.stringify(reviewForm),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to submit review");

      setMessage(payload?.message || "Review submitted successfully.");

      const [summaryRes, eligibilityRes, mineRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(numericEventId)}/summary`),
        fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(numericEventId)}/eligibility`, {
          headers: { "x-user-id": String(numericUserId) },
        }),
        fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(numericEventId)}/mine`, {
          headers: { "x-user-id": String(numericUserId) },
        }),
      ]);

      const summaryPayload = await summaryRes.json().catch(() => ({}));
      const eligibilityPayload = await eligibilityRes.json().catch(() => ({}));
      const minePayload = await mineRes.json().catch(() => ({}));

      if (summaryRes.ok) {
        setReviewSummary(summaryPayload?.summary || null);
        setOrganizerReputation(summaryPayload?.organizerReputation || null);
      }
      if (eligibilityRes.ok) setReviewEligibility(eligibilityPayload?.eligibility || null);
      if (mineRes.ok) setMyReview(minePayload?.review || null);
    } catch (err) {
      setMessage(err?.message || "Failed to submit review.");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  if (!eventId) return <main className="min-h-screen shell"><div className="p-6">No event specified.</div></main>;
  if (!eventData) return <main className="min-h-screen shell"><div className="p-6">Event not found.</div></main>;

  const capacity = Number(eventData.Capacity ?? eventData.capacity ?? eventData.seats ?? 0);
  const confirmed = Number(eventData.ConfirmedRegistrations ?? 0);
  const seatsLeft = capacity > 0 ? Math.max(capacity - confirmed, 0) : null;

  const organizerName = eventData.Organizer || eventData.OrganizationName || "Organizer";
  const organizerEmail = eventData.OrganizerEmail || eventData.OrganizerAccountEmail || "Not shared";
  const organizerCity = eventData.OrganizerCity || eventData.City || "Not specified";
  const organizerDescription = eventData.OrganizerDescription || "No organizer description available.";
  const organizerLogo = eventData.OrganizerLogo || DEFAULT_ORGANIZER_LOGO;
  const posterSrc = eventData.PosterURL || DEFAULT_EVENT_POSTER;

  const reviewCount = Number(reviewSummary?.reviewCount || 0);
  const canSubmitReview = Boolean(reviewEligibility?.canReview && !myReview);

  const reviewFieldConfig = [
    { key: "overallRating", label: "Overall Experience" },
    { key: "organizationQualityRating", label: "Organization Quality" },
    { key: "contentQualityRating", label: "Content/Speaker Quality" },
    { key: "venueRating", label: "Venue Appropriateness" },
    { key: "valueForTimeRating", label: "Value for Time" },
  ];

  return (
    <main className="min-h-screen shell">
      <div className="surface-card overflow-hidden p-0 max-w-6xl mx-auto">
        <div className="relative h-56 w-full overflow-hidden border-b border-[var(--stroke)] bg-slate-100 md:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterSrc} alt="Event poster" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Student View</p>
              <h1 className="text-2xl font-extrabold md:text-3xl">{eventData.title || eventData.Title}</h1>
              <p className="text-sm opacity-90">{eventData.eventType || eventData.EventType || "Event"}</p>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              {eventData.Status || eventData.status || "Published"}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="w-44 rounded bg-white p-3 text-center shadow-sm">
              <Link href="/dashboard" className="inline-block text-sm text-slate-600 hover:underline">Back to Dashboard</Link>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h2 className="mb-2 text-lg font-bold text-slate-900">Event Details</h2>
              <p className="text-sm text-slate-700"><strong>Date:</strong> {formatDate(eventData.eventDate || eventData.EventDate)}</p>
              <p className="text-sm text-slate-700"><strong>Time:</strong> {formatTime(eventData.eventTime || eventData.EventTime || eventData.Time)}</p>
              <p className="text-sm text-slate-700"><strong>Venue:</strong> {eventData.venue || eventData.Venue || "TBA"}</p>
              <p className="text-sm text-slate-700"><strong>City:</strong> {eventData.city || eventData.City || "Not specified"}</p>
              <p className="mt-2 text-sm text-slate-700">{eventData.description || eventData.Description || ""}</p>
            </div>

            <div className="rounded bg-[var(--surface-soft)] p-4 md:col-span-2">
              <p className="text-sm text-slate-600"><strong>Capacity:</strong> {capacity || "Unlimited"}</p>
              <p className="text-sm text-slate-600"><strong>Confirmed Registrations:</strong> {confirmed}</p>
              <p className="text-sm text-slate-600"><strong>Seats Left:</strong> {seatsLeft === null ? "Unlimited" : seatsLeft}</p>
              <p className="text-sm text-slate-600"><strong>Registration Deadline:</strong> {formatDate(eventData.RegistrationDeadline)}</p>
              <p className="text-sm text-slate-600"><strong>Status:</strong> {eventData.Status || eventData.status || "Published"}</p>

              <div className="mt-4 rounded-lg border border-[var(--stroke)] bg-white p-3">
                <h3 className="font-semibold text-slate-800">Organizer Details</h3>
                <div className="mt-2 flex items-start gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-[var(--stroke)] bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={organizerLogo} alt="Organizer logo" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-700"><strong>Name:</strong> {organizerName}</p>
                    <p className="text-sm text-slate-700"><strong>Email:</strong> {organizerEmail}</p>
                    <p className="text-sm text-slate-700"><strong>City:</strong> {organizerCity}</p>
                    <p className="text-sm text-slate-700"><strong>Reputation Score:</strong> {organizerReputation?.reputationScore ?? "N/A"}</p>
                    <p className="text-sm text-slate-700"><strong>Tier:</strong> {organizerReputation?.reputationTier || "Not rated yet"}</p>
                    <p className="text-sm text-slate-700"><strong>Avg Overall:</strong> {reviewSummary?.avgOverallRating ?? "N/A"} ({reviewCount} review{reviewCount === 1 ? "" : "s"})</p>
                    <p className="mt-2 text-sm text-slate-600">{organizerDescription}</p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams({
                            eventId: String(eventId),
                            organizerId: String(eventData.OrganizerID || reviewSummary?.organizerId || ""),
                            returnTo: `/viewEvent?eventId=${String(eventId)}`,
                          });
                          router.push(`/event/reviews?${params.toString()}`);
                        }}
                        className="rounded-md border border-[var(--stroke)] bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        See Reviews
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                {isRegistered ? (
                  <button onClick={handleUnregister} disabled={isBusy} className="rounded-md bg-red-600 px-4 py-2 text-white disabled:opacity-60">
                    {isBusy ? "Working..." : "Unregister"}
                  </button>
                ) : (
                  <button
                    onClick={() => { router.push(`/registerEvent?eventId=${encodeURIComponent(eventId)}`); }}
                    className="cta px-4 py-2"
                  >
                    Register
                  </button>
                )}
              </div>

              {isRegistered && (
                <div className="mt-4 rounded-lg border border-[var(--stroke)] bg-white p-3">
                  <h3 className="font-semibold text-slate-800">Check-In QR</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Use the QR Code tab in your student dashboard for attendance check-in.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-[var(--stroke)] bg-white p-4">
                <h3 className="font-semibold text-slate-800">Rate This Event</h3>

                {myReview ? (
                  <div className="mt-2 rounded bg-emerald-50 p-3 text-sm text-emerald-800">
                    You already submitted a review with overall rating {myReview.overallRating}/5.
                  </div>
                ) : canSubmitReview ? (
                  <>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {reviewFieldConfig.map((field) => (
                        <label key={field.key} className="text-sm text-slate-700">
                          <span className="block font-medium text-slate-800">{field.label}</span>
                          <select
                            value={reviewForm[field.key]}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setReviewForm((prev) => ({ ...prev, [field.key]: value }));
                            }}
                            className="mt-1 w-full rounded-md border border-[var(--stroke)] bg-white px-2 py-2"
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <option key={star} value={star}>{star} / 5</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>

                    <label className="mt-3 block text-sm text-slate-700">
                      <span className="block font-medium text-slate-800">Detailed Review</span>
                      <textarea
                        value={reviewForm.reviewText}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewText: e.target.value }))}
                        placeholder="Share what worked, what can improve, and whether you'd recommend this organizer."
                        rows={4}
                        className="mt-1 w-full rounded-md border border-[var(--stroke)] bg-white px-3 py-2"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={isSubmittingReview}
                      className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSubmittingReview ? "Submitting..." : "Submit Review"}
                    </button>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    {reviewEligibility?.reason || "You can review this event after completion if you attended."}
                  </p>
                )}
              </div>

              {isRegistered && (eventData.eventType || eventData.EventType || "").toLowerCase() === "competition" && (
                <div className="mt-4">
                  {isLoadingTeam ? (
                    <div className="p-4 text-center text-slate-600">Loading team info...</div>
                  ) : pendingInvite?.teamId ? (
                    <TeamInviteAction
                      teamId={pendingInvite.teamId}
                      teamName={pendingInvite.teamName}
                      eventId={Number(eventId)}
                      userId={Number(userId)}
                      onInviteResponded={(action) => {
                        setPendingInvite(null);
                        if (action === "accepted") {
                          setIsLoadingTeam(true);
                          fetch(`${API_BASE_URL}/api/teams/user/${Number(userId)}?eventId=${Number(eventId)}`, {
                            headers: { "x-user-id": String(Number(userId)) },
                          })
                            .then((res) => (res.ok ? res.json() : null))
                            .then((data) => setTeamData(data))
                            .finally(() => setIsLoadingTeam(false));
                        }
                      }}
                    />
                  ) : teamData?.id ? (
                    <TeamManagementCard
                      teamId={teamData.id}
                      teamName={teamData.name}
                      leaderId={teamData.leaderId}
                      leaderName={teamData.leaderName}
                      userId={Number(userId)}
                      eventId={Number(eventId)}
                    />
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setShowCreateTeamModal(true)}
                        className="flex-1 rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-4 py-2 font-semibold text-white hover:shadow-lg"
                      >
                        Form a Team
                      </button>
                    </div>
                  )}
                </div>
              )}

              {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
            </div>
          </div>
        </div>
      </div>

      <CreateTeamModal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        eventId={Number(eventId)}
        userId={Number(userId)}
        onTeamCreated={(teamId) => {
          setPendingInvite(null);
          setTeamData({ id: teamId, name: "", leaderId: Number(userId) });
          setIsLoadingTeam(false);
        }}
      />
    </main>
  );
}
