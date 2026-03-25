"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Chart.js imports
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

export default function AchievementsUser() {
  const [achievements, setAchievements] = useState([]);
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") || sessionStorage.getItem("userID") || localStorage.getItem("userId") || "anonymous")
    : "anonymous";

  useEffect(() => {
    const all = JSON.parse(localStorage.getItem("studentAchievements") || "[]");
    const ev = JSON.parse(localStorage.getItem("events") || "[]");
    const regs = JSON.parse(localStorage.getItem("registrations") || "[]");
    setAchievements(all.filter(a => String(a.userId) === String(userId)).sort((a,b)=>b.id-a.id));
    setEvents(ev);
    setRegistrations(regs.filter(r=>String(r.userId)===String(userId) && r.status === "Registered"));
  }, [userId]);

  const stats = useMemo(() => {
    const totalAchievements = achievements.length;
    const uniqueEventIds = new Set(registrations.map(r=>String(r.eventId)));
    const eventsParticipated = uniqueEventIds.size;
    const counts = { first: 0, second: 0, third: 0, other: 0 };
    achievements.forEach(a => {
      const p = (a.position || "").toLowerCase();
      if (p.includes("1") || p.includes("first") || p.includes("winner") || p.includes("gold")) counts.first++;
      else if (p.includes("2") || p.includes("second") || p.includes("silver")) counts.second++;
      else if (p.includes("3") || p.includes("third") || p.includes("bronze")) counts.third++;
      else counts.other++;
    });
    return { totalAchievements, eventsParticipated, counts };
  }, [achievements, registrations]);

  // Chart: medal breakdown (bar)
  const medalChartData = useMemo(() => {
    return {
      labels: ["1st / Winner", "2nd", "3rd", "Other"],
      datasets: [
        {
          label: "Medals",
          data: [stats.counts.first, stats.counts.second, stats.counts.third, stats.counts.other],
          backgroundColor: ["#FBBF24", "#94A3B8", "#FB923C", "#CBD5E1"],
        },
      ],
    };
  }, [stats]);

  const medalOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Medal Breakdown" },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  // Chart: achievements over time (monthly counts)
  const timeChartData = useMemo(() => {
    // group by month-year
    const map = new Map();
    achievements.forEach(a => {
      const d = a.achievementDate ? new Date(a.achievementDate) : new Date(a.createdAt || a.id);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const entries = Array.from(map.entries()).sort((a,b)=>new Date(a[0]) - new Date(b[0]));
    const labels = entries.map(e => e[0]);
    const data = entries.map(e => e[1]);
    return {
      labels,
      datasets: [
        {
          label: "Achievements",
          data,
          borderColor: "#0EA5A3",
          backgroundColor: "rgba(14,165,163,0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 3
        }
      ],
    };
  }, [achievements]);

  const timeOptions = {
    responsive: true,
    plugins: { legend: { display: false }, title: { display: true, text: "Achievements Over Time" } },
    scales: {
      x: {
        type: "time",
        time: { unit: "month", tooltipFormat: "MMM yyyy", displayFormats: { month: "MMM yyyy" } }
      },
      y: { beginAtZero: true, ticks: { precision: 0 } }
    }
  };

  // helper to get event title
  function titleFor(id) {
    const e = events.find(x=>String(x.id)===String(id));
    return e ? `${e.title} — ${e.eventDate || ''}` : `Event ${id}`;
  }

  return (
    <main className="min-h-screen shell">
      <div className="surface-card p-6 md:p-8 max-w-5xl mx-auto">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Achievements</h1>
            <p className="text-sm text-slate-600 mt-1">Overview of events participated and prizes won. Data is read from localStorage (studentAchievements, events, registrations).</p>
          </div>

          {/* Top-right box: only Back to Dashboard */}
          <div className="ml-4 w-44 shrink-0">
            <div className="p-3 bg-white rounded shadow-sm text-center">
              <Link href="/dashboard" className="inline-block text-sm text-slate-600 hover:underline">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white rounded shadow-sm">
            <p className="text-xs text-slate-500">Events Participated</p>
            <p className="text-2xl font-semibold">{stats.eventsParticipated}</p>
          </div>
          <div className="p-4 bg-white rounded shadow-sm">
            <p className="text-xs text-slate-500">Achievements Recorded</p>
            <p className="text-2xl font-semibold">{stats.totalAchievements}</p>
          </div>
          <div className="p-4 bg-white rounded shadow-sm">
            <p className="text-xs text-slate-500">Top Medals</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">1st / Winner</span>
                <span className="font-medium">{stats.counts.first}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">2nd</span>
                <span className="font-medium">{stats.counts.second}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">3rd</span>
                <span className="font-medium">{stats.counts.third}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Charts row moved below stats */}
        <section className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-white rounded shadow-sm">
            <Bar data={medalChartData} options={medalOptions} />
          </div>
          <div className="p-4 bg-white rounded shadow-sm">
            <Line data={timeChartData} options={timeOptions} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">All Achievements</h2>
          </div>

          {achievements.length === 0 ? (
            <div className="p-6 bg-white rounded text-slate-600">No achievements recorded yet. Add them via the Achievements form.</div>
          ) : (
            <div className="space-y-3">
              {achievements.map(a => (
                <article key={a.id} className="p-4 bg-white rounded shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{a.position || "Participation"} • {titleFor(a.eventId)}</h3>
                      <p className="text-sm text-slate-500">{a.achievementDate} · Recorded: {new Date(a.createdAt || a.id).toLocaleDateString()}</p>
                      {a.description && <p className="mt-2 text-sm text-slate-700">{a.description}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">ID {a.id}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}