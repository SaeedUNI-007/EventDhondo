"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function asDateString(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

export default function AchievementsUser() {
  const searchParams = useSearchParams();
  const publicUserId = searchParams.get("publicUserId");

  const currentUserId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("userId") ||
          sessionStorage.getItem("userID") ||
          localStorage.getItem("userId") ||
          localStorage.getItem("userID") ||
          "")
      : "";

  const targetUserId = publicUserId || currentUserId;
  const isPublicView = Boolean(publicUserId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [mostActiveCategories, setMostActiveCategories] = useState([]);
  const [skillTags, setSkillTags] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!Number.isInteger(Number(targetUserId))) {
        setError("Valid user is required to load portfolio.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const endpoint = isPublicView
          ? `${API_BASE_URL}/api/portfolio/public/${encodeURIComponent(targetUserId)}`
          : `${API_BASE_URL}/api/portfolio/${encodeURIComponent(targetUserId)}`;

        const res = await fetch(endpoint, {
          headers: isPublicView
            ? { "Content-Type": "application/json" }
            : {
                "Content-Type": "application/json",
                "x-user-id": String(currentUserId || targetUserId),
              },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load portfolio");
        }

        setSummary(data.summary || null);
        setProfile(data.profile || null);
        setAchievements(Array.isArray(data.achievements) ? data.achievements : []);
        const rawParticipations = Array.isArray(data.participations) ? data.participations : [];
        const safeParticipations = rawParticipations.filter((row) => {
          const attended = Boolean(row?.Attended);
          const completed =
            row?.IsCompleted === true ||
            row?.IsCompleted === 1 ||
            String(row?.IsCompleted || "").toLowerCase() === "true";
          return attended && completed;
        });
        setParticipations(safeParticipations);
        setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
        setMostActiveCategories(Array.isArray(data.mostActiveCategories) ? data.mostActiveCategories : []);
        setSkillTags(Array.isArray(data.skillTags) ? data.skillTags : []);
      } catch (err) {
        setError(err?.message || "Could not load portfolio.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [targetUserId, currentUserId, isPublicView]);

  const medalCounts = useMemo(() => {
    return {
      first: Number(summary?.FirstPlaceCount || 0),
      second: Number(summary?.SecondPlaceCount || 0),
      third: Number(summary?.ThirdPlaceCount || 0),
      other: Math.max(
        Number(summary?.TotalAchievements || 0) -
          Number(summary?.FirstPlaceCount || 0) -
          Number(summary?.SecondPlaceCount || 0) -
          Number(summary?.ThirdPlaceCount || 0),
        0
      ),
    };
  }, [summary]);

  const medalChartData = useMemo(
    () => ({
      labels: ["1st / Winner", "2nd", "3rd", "Other"],
      datasets: [
        {
          label: "Positions",
          data: [medalCounts.first, medalCounts.second, medalCounts.third, medalCounts.other],
          backgroundColor: ["#FBBF24", "#94A3B8", "#FB923C", "#CBD5E1"],
        },
      ],
    }),
    [medalCounts]
  );

  const medalOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Position Breakdown" },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const timelineData = useMemo(() => {
    const labels = timeline.map((row) => row.MonthStart);
    const achievementCounts = timeline.map((row) => Number(row.AchievementsCount || 0));
    const distinctEventCounts = timeline.map((row) => Number(row.DistinctEvents || 0));
    return {
      labels,
      datasets: [
        {
          label: "Achievements Added",
          data: achievementCounts,
          borderColor: "#0EA5A3",
          backgroundColor: "rgba(14,165,163,0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: "Distinct Events",
          data: distinctEventCounts,
          borderColor: "#334155",
          backgroundColor: "rgba(51,65,85,0.08)",
          fill: false,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    };
  }, [timeline]);

  const timelineOptions = {
    responsive: true,
    plugins: {
      legend: { display: true },
      title: { display: true, text: "Monthly Progress: Achievements vs Distinct Events" },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const index = items?.[0]?.dataIndex;
            if (index === undefined || index === null) return "";
            const titles = timeline[index]?.EventTitles;
            return titles ? `Events: ${titles}` : "";
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        time: { unit: "month", tooltipFormat: "MMM yyyy", displayFormats: { month: "MMM yyyy" } },
      },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const exportPdf = () => {
    window.print();
  };

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Student Portfolio</h1>
            <p className="text-sm text-slate-600 mt-1">
              Participation history, achievements, skills, and category performance.
            </p>
            {summary?.StudentName && <p className="mt-1 text-sm text-slate-500">{summary.StudentName}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isPublicView && (
              <>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold"
                >
                  Export PDF
                </button>
                <Link href="/profile" className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold">
                  Edit Profile Links
                </Link>
                <Link href="/dashboard" className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold">
                  Back to Dashboard
                </Link>
              </>
            )}
            {isPublicView && (
              <Link href="/" className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold">
                Back to Home
              </Link>
            )}
          </div>
        </header>

        {loading && <p className="text-slate-600">Loading portfolio...</p>}
        {error && <p className="rounded-lg bg-rose-50 p-3 text-[var(--danger)]">{error}</p>}

        {!loading && !error && summary && (
          <>
            <section className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-white rounded shadow-sm">
                <p className="text-xs text-slate-500">Events Attended</p>
                <p className="text-2xl font-semibold">{Number(summary.TotalEventsAttended || 0)}</p>
              </div>
              <div className="p-4 bg-white rounded shadow-sm">
                <p className="text-xs text-slate-500">Events Registered</p>
                <p className="text-2xl font-semibold">{Number(summary.TotalEventsRegistered || 0)}</p>
              </div>
              <div className="p-4 bg-white rounded shadow-sm">
                <p className="text-xs text-slate-500">Achievements</p>
                <p className="text-2xl font-semibold">{Number(summary.TotalAchievements || 0)}</p>
              </div>
              <div className="p-4 bg-white rounded shadow-sm">
                <p className="text-xs text-slate-500">Competition Win Rate</p>
                <p className="text-2xl font-semibold">{Number(summary.CompetitionWinRatePercent || 0).toFixed(2)}%</p>
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-white rounded shadow-sm">
                <Bar data={medalChartData} options={medalOptions} />
              </div>
              <div className="p-4 bg-white rounded shadow-sm">
                <p className="mb-2 text-xs text-slate-600">
                  This graph shows how many achievements were added each month and how many distinct events those achievements came from.
                </p>
                <Line data={timelineData} options={timelineOptions} />
              </div>
            </section>

            <section className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded shadow-sm md:col-span-2">
                <h2 className="text-lg font-semibold mb-2">Most Active Categories</h2>
                {mostActiveCategories.length === 0 ? (
                  <p className="text-sm text-slate-600">No attended event categories yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mostActiveCategories.map((row) => (
                      <span key={`${row.EventType}-${row.Count}`} className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm font-medium">
                        {row.EventType}: {row.Count}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-2">Skill Tags</h2>
                {skillTags.length === 0 ? (
                  <p className="text-sm text-slate-600">No skill tags mapped yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skillTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-white rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-2">Project / Profile Links</h2>
                <ul className="space-y-2 text-sm">
                  <li>
                    <span className="font-medium">LinkedIn: </span>
                    {profile?.LinkedInURL ? (
                      <a className="text-[var(--brand-strong)] underline" href={profile.LinkedInURL} target="_blank" rel="noreferrer">
                        {profile.LinkedInURL}
                      </a>
                    ) : (
                      <span className="text-slate-500">Not set</span>
                    )}
                  </li>
                  <li>
                    <span className="font-medium">GitHub: </span>
                    {profile?.GitHubURL ? (
                      <a className="text-[var(--brand-strong)] underline" href={profile.GitHubURL} target="_blank" rel="noreferrer">
                        {profile.GitHubURL}
                      </a>
                    ) : (
                      <span className="text-slate-500">Not set</span>
                    )}
                  </li>
                </ul>
              </div>

              <div className="p-4 bg-white rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-2">Portfolio Snapshot</h2>
                <p className="text-sm text-slate-700">Department: {profile?.Department || summary?.Department || "-"}</p>
                <p className="text-sm text-slate-700">Year of Study: {profile?.YearOfStudy || summary?.YearOfStudy || "-"}</p>
                <p className="text-sm text-slate-700">1st Place: {Number(summary.FirstPlaceCount || 0)}</p>
                <p className="text-sm text-slate-700">2nd Place: {Number(summary.SecondPlaceCount || 0)}</p>
                <p className="text-sm text-slate-700">3rd Place: {Number(summary.ThirdPlaceCount || 0)}</p>
              </div>
            </section>

            <section className="mb-6">
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Achievements</h2>
              {achievements.length === 0 ? (
                <div className="p-6 bg-white rounded text-slate-600">No achievements recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {achievements.map((a, idx) => (
                    <article key={`${a.EventTitle}-${a.AchievementDate}-${idx}`} className="p-4 bg-white rounded shadow-sm">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {a.Position || "Participation"} • {a.EventTitle || "Event"}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {asDateString(a.AchievementDate)} • {a.EventType || "Event"} • Awarded by {a.AwardedBy || "Organizer"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
