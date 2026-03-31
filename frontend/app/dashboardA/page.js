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
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const userId = typeof window !== 'undefined'
          ? (sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId'))
          : null;

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
          const normalizedRows = Array.isArray(rows)
            ? rows.map((row, idx) => ({
                id: row.id || idx + 1,
                type: row.type || row.Type || row.ActivityType || "Activity",
                actor: row.actor || row.Actor || row.Source || "System",
                target: row.target || row.Target || row.Description || "-",
                at: row.at || row.At || row.Timestamp || "-",
              }))
            : [];
          setActivity(normalizedRows.slice(0, 5));
        } else {
          const payload = await activityRes.json().catch(() => ({}));
          setError(`Could not load recent activity: ${payload?.message || activityRes.status}`);
        }
      } catch (_err) {
        setError("Could not load admin dashboard data: " + _err.message);
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
              {!activity.length && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-slate-500">No recent activity found yet.</td>
                </tr>
              )}
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
