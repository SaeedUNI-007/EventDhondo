"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function StarRow({ value }) {
  const n = Number(value || 0);
  return (
    <span className="text-amber-500" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}{"☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, n))))}
    </span>
  );
}

export default function EventReviewsPage() {
  const search = useSearchParams();
  const eventId = search.get("eventId");
  const organizerId = search.get("organizerId");
  const returnToParam = search.get("returnTo");

  const userId = typeof window !== "undefined"
    ? Number(sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || 0)
    : 0;
  const userRole = typeof window !== "undefined"
    ? String(sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || "").toLowerCase()
    : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventSummary, setEventSummary] = useState(null);
  const [organizerReputation, setOrganizerReputation] = useState(null);
  const [eventReviews, setEventReviews] = useState([]);
  const [organizerReviews, setOrganizerReviews] = useState([]);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [savingResponseId, setSavingResponseId] = useState(null);
  const [notice, setNotice] = useState("");

  const canRespond = useMemo(() => {
    if (userRole !== "organizer") return false;
    if (!Number.isInteger(userId) || userId <= 0) return false;
    return Number(userId) === Number(organizerId || 0);
  }, [userId, userRole, organizerId]);

  const safeReturnTo = useMemo(() => {
    if (returnToParam && returnToParam.startsWith("/")) return returnToParam;
    if (userRole === "organizer") return "/dashboardO";
    if (userRole === "admin") return "/dashboardA";
    return "/dashboard";
  }, [returnToParam, userRole]);

  const backToEventHref = useMemo(() => {
    if (safeReturnTo.startsWith("/viewEvent") || safeReturnTo.startsWith("/viewEventO")) {
      return safeReturnTo;
    }
    if (userRole === "organizer") {
      return `/viewEventO?eventId=${encodeURIComponent(eventId || "")}&returnTo=${encodeURIComponent(safeReturnTo)}`;
    }
    return `/viewEvent?eventId=${encodeURIComponent(eventId || "")}`;
  }, [safeReturnTo, userRole, eventId]);

  const loadData = async () => {
    if (!eventId) {
      setError("No event selected.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [summaryRes, eventReviewsRes, organizerReviewsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(eventId)}/summary`),
        fetch(`${API_BASE_URL}/api/reviews/events/${encodeURIComponent(eventId)}`),
        organizerId
          ? fetch(`${API_BASE_URL}/api/reviews/organizers/${encodeURIComponent(organizerId)}`)
          : Promise.resolve(null),
      ]);

      const summaryPayload = await summaryRes.json().catch(() => ({}));
      const eventReviewsPayload = await eventReviewsRes.json().catch(() => ({}));
      const organizerReviewsPayload = organizerReviewsRes
        ? await organizerReviewsRes.json().catch(() => ({}))
        : {};

      if (!summaryRes.ok) throw new Error(summaryPayload?.message || "Failed to load summary");
      if (!eventReviewsRes.ok) throw new Error(eventReviewsPayload?.message || "Failed to load event reviews");

      setEventSummary(summaryPayload?.summary || null);
      setOrganizerReputation(summaryPayload?.organizerReputation || organizerReviewsPayload?.organizerReputation || null);
      setEventReviews(Array.isArray(eventReviewsPayload?.reviews) ? eventReviewsPayload.reviews : []);
      setOrganizerReviews(Array.isArray(organizerReviewsPayload?.reviews) ? organizerReviewsPayload.reviews : []);

      const draftMap = {};
      (Array.isArray(eventReviewsPayload?.reviews) ? eventReviewsPayload.reviews : []).forEach((r) => {
        draftMap[r.reviewId] = r?.response?.responseText || "";
      });
      setResponseDrafts(draftMap);
    } catch (err) {
      setError(err?.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId, organizerId]);

  async function saveResponse(reviewId) {
    const text = String(responseDrafts[reviewId] || "").trim();
    if (!text) {
      setNotice("Response text cannot be empty.");
      return;
    }

    setSavingResponseId(reviewId);
    setNotice("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/${encodeURIComponent(reviewId)}/response`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({ responseText: text }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to save response");
      setNotice(payload?.message || "Response saved.");
      await loadData();
    } catch (err) {
      setNotice(err?.message || "Failed to save response.");
    } finally {
      setSavingResponseId(null);
    }
  }

  if (loading) {
    return <main className="min-h-screen shell"><div className="p-6">Loading reviews...</div></main>;
  }

  if (error) {
    return (
      <main className="min-h-screen shell">
        <div className="mx-auto max-w-5xl p-6">
          <p className="rounded-md bg-rose-50 p-3 text-rose-700">{error}</p>
          <Link href={safeReturnTo} className="mt-3 inline-block text-sm text-slate-700 hover:underline">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen shell">
      <div className="mx-auto max-w-6xl p-6">
        <div className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke)] pb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Ratings & Reviews</p>
              <h1 className="text-xl font-bold text-slate-900">{eventSummary?.eventTitle || "Event Reviews"}</h1>
              <p className="text-sm text-slate-600">{eventSummary?.organizationName || "Organizer"}</p>
            </div>
            <Link href={backToEventHref} className="rounded-md border border-[var(--stroke)] px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Back to Event
            </Link>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Event Overall</p>
              <p className="text-2xl font-bold text-slate-900">{eventSummary?.avgOverallRating ?? "N/A"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Reputation Score</p>
              <p className="text-2xl font-bold text-slate-900">{organizerReputation?.reputationScore ?? "N/A"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Reputation Tier</p>
              <p className="text-2xl font-bold text-slate-900">{organizerReputation?.reputationTier || "Not rated"}</p>
            </div>
          </div>

          {notice && <p className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">Reviews for This Event</h2>
            {eventReviews.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No reviews yet for this event.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {eventReviews.map((review) => (
                  <article key={review.reviewId} className="rounded-lg border border-[var(--stroke)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{review.reviewerName}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(review.createdAt)}</p>
                      </div>
                      <StarRow value={review.overallRating} />
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                      <p>Organization: {review.organizationQualityRating}/5</p>
                      <p>Content/Speaker: {review.contentQualityRating}/5</p>
                      <p>Venue: {review.venueRating}/5</p>
                      <p>Value for Time: {review.valueForTimeRating}/5</p>
                    </div>

                    {review.reviewText && <p className="mt-3 text-sm text-slate-700">{review.reviewText}</p>}

                    {review.response ? (
                      <div className="mt-3 rounded-md bg-emerald-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Organizer Response</p>
                        <p className="mt-1 text-sm text-emerald-900">{review.response.responseText}</p>
                        <p className="mt-1 text-xs text-emerald-700">{formatDateTime(review.response.responseDate)}</p>
                      </div>
                    ) : null}

                    {canRespond ? (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Respond as Organizer</label>
                        <textarea
                          rows={3}
                          value={responseDrafts[review.reviewId] || ""}
                          onChange={(e) => setResponseDrafts((prev) => ({ ...prev, [review.reviewId]: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-[var(--stroke)] px-3 py-2 text-sm"
                          placeholder="Share a professional response to this review."
                        />
                        <button
                          type="button"
                          onClick={() => saveResponse(review.reviewId)}
                          disabled={savingResponseId === review.reviewId}
                          className="mt-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {savingResponseId === review.reviewId ? "Saving..." : "Save Response"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 border-t border-[var(--stroke)] pt-6">
            <h2 className="text-lg font-semibold text-slate-900">All Reviews for This Organizer</h2>
            <p className="text-sm text-slate-600">Showing historical feedback to help students make informed decisions.</p>

            {organizerReviews.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No organizer reviews yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {organizerReviews.slice(0, 30).map((review) => (
                  <div key={`org-${review.reviewId}`} className="rounded-md border border-[var(--stroke)] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{review.eventTitle}</p>
                      <span className="text-sm text-slate-700">Overall {review.overallRating}/5</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">By {review.reviewerName} • {formatDateTime(review.createdAt)}</p>
                    {review.response ? <p className="mt-2 text-xs text-emerald-700">Organizer responded</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
