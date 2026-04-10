"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getCurrentUserId() {
  if (typeof window === "undefined") return "";
  return (
    sessionStorage.getItem("userId") ||
    sessionStorage.getItem("userID") ||
    localStorage.getItem("userId") ||
    localStorage.getItem("userID") ||
    ""
  );
}

export default function SidebarNotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) {
          if (mounted) setCount(0);
          return;
        }

        const qs = new URLSearchParams({ filter: "unread", page: "1", limit: "1000", userId: String(userId) });
        const res = await fetch(`${API_BASE_URL}/api/notifications?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setCount(Number(json.total || 0));
      } catch (_err) {
        // Keep sidebar stable even if notifications endpoint is temporarily unavailable.
      }
    };

    load();
    const t = setInterval(load, 30000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <span className="relative inline-flex items-center justify-center">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.44V11a6 6 0 10-12 0v3.16c0 .54-.21 1.05-.6 1.44L4 17h11z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 min-w-[16px] rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-4 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}
