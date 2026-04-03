"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BadgeCheck, CalendarRange, Lightbulb, Shield } from "lucide-react";
import { Bell } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboardA", label: "Overview", icon: BarChart3 },
  { href: "/dashboardA/verification", label: "Organizer Verification", icon: BadgeCheck },
  { href: "/dashboardA/events", label: "Manage Events", icon: CalendarRange },
  { href: "/dashboardA/student-events", label: "Student Events", icon: CalendarRange },
  { href: "/dashboardA/requests", label: "Student Requests", icon: Lightbulb },
  // Notifications placed immediately after Student Requests
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const role = String(sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || "").toLowerCase();
    if (role !== "admin") {
      router.replace("/login");
      return;
    }
    setIsAllowed(true);
  }, [router]);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  if (!isAllowed) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-600">Checking admin access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-0 py-8 text-slate-900">
      <div className="shell">
        <div className="hidden lg:block">
          <aside className="fixed left-0 top-0 h-screen w-80 bg-[linear-gradient(180deg,#0f766e,#34d399)] border-r border-[var(--stroke)] z-10">
            <div className="sticky top-6 h-[calc(100vh-48px)] overflow-hidden px-6 py-8 text-white">
              <div className="mb-8 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/80">EventDhondo</p>
                  <h1 className="text-lg font-bold">Admin Console</h1>
                </div>
              </div>

              <nav>
                <ul className="space-y-2">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition ${
                            active
                              ? "bg-white text-[var(--brand-strong)]"
                              : "text-white hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="mt-8 border-t border-white/25 pt-4">
                <Link href="/" className="text-sm text-white/85 hover:text-white">
                  Return to Home
                </Link>
              </div>
            </div>
          </aside>
        </div>

        <section className="mx-auto max-w-[1200px] lg:ml-80 px-4">
          <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6">
            <p className="text-xs uppercase tracking-wide text-[var(--brand-strong)]">Campus Control Center</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-3xl font-extrabold">Admin Dashboard</h2>
              <p className="text-sm text-slate-600">{todayLabel}</p>
            </div>
          </header>

          <div className="lg:hidden mb-6">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <nav>
                <ul className="space-y-2">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium ${
                            active
                              ? "bg-white text-[var(--brand-strong)]"
                              : "text-slate-700 hover:bg-white"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
