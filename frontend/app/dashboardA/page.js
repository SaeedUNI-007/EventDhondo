"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, UserRound, UserRoundCheck, Ticket } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const FALLBACK_STATS = {
  totalUsers: 482,
  activeEvents: 23,
  pendingOrganizers: 6,
  totalRegistrations: 1327,
};

const FALLBACK_ACTIVITY = [
  { id: 1, type: "Registration", actor: "Areeba Khan", target: "DevHack 2026", at: "2026-03-21 10:42" },
  { id: 2, type: "Event", actor: "ACM Student Chapter", target: "Published AI Sprint", at: "2026-03-21 09:55" },
  { id: 3, type: "Registration", actor: "Ahmed Raza", target: "Basketball Trials", at: "2026-03-20 18:14" },
  { id: 4, type: "User", actor: "Hina Aslam", target: "Created student account", at: "2026-03-20 16:02" },
  { id: 5, type: "Event", actor: "FAST Sports Board", target: "Updated venue details", at: "2026-03-20 14:40" },
];

function StatCard({ title, value, icon: Icon, tone }) {
  return (
    <article className="surface-card reveal-up p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p>
    </article>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [activity, setActivity] = useState(FALLBACK_ACTIVITY);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userID') : null;

        const headers = { 'Content-Type': 'application/json' };
        if (userId) {
          headers['x-user-id'] = userId;
        }

        const statsRes = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({
            totalUsers: Number(data.totalUsers ?? FALLBACK_STATS.totalUsers),
            activeEvents: Number(data.activeEvents ?? FALLBACK_STATS.activeEvents),
            pendingOrganizers: Number(data.pendingOrganizers ?? FALLBACK_STATS.pendingOrganizers),
            totalRegistrations: Number(data.totalRegistrations ?? FALLBACK_STATS.totalRegistrations),
          });
        } else {
          setError("Using fallback stats because admin stats endpoint returned: " + statsRes.status);
        }

        const activityRes = await fetch(`${API_BASE_URL}/api/admin/recent-activity`, { headers });
        if (activityRes.ok) {
          const rows = await activityRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            setActivity(rows.slice(0, 5));
          }
        }
      } catch (_err) {
        setError("Using fallback data due to API connectivity issues: " + _err.message);
      }
    };

    load();
  }, []);

  const cards = useMemo(
    () => [
      { title: "Total Users", value: stats.totalUsers, icon: UserRound, tone: "bg-sky-50 text-sky-600" },
      { title: "Active Events", value: stats.activeEvents, icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600" },
      { title: "Pending Organizer Requests", value: stats.pendingOrganizers, icon: UserRoundCheck, tone: "bg-amber-50 text-amber-600" },
      { title: "Total Registrations", value: stats.totalRegistrations, icon: Ticket, tone: "bg-violet-50 text-violet-600" },
    ],
    [stats]
  );

  return (
    <main className="space-y-6">
      {error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 border border-amber-200">{error}</p>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      <section className="glass reveal-up rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Recent Activity</h3>
          <span className="text-xs uppercase tracking-wide text-slate-500">Last 5 entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Actor</th>
                <th className="px-2 py-2">Details</th>
                <th className="px-2 py-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.id || `${row.type}-${row.actor}-${row.at}`} className="border-b border-slate-100 last:border-none">
                  <td className="px-2 py-3">{row.type}</td>
                  <td className="px-2 py-3 font-medium text-slate-800">{row.actor}</td>
                  <td className="px-2 py-3">{row.target}</td>
                  <td className="px-2 py-3 text-slate-500">{row.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
