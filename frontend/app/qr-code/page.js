"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function StudentQrCodePage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId") || "";
    const storedEmail = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "";
    setUserId(storedUserId);
    setEmail(storedEmail);

    const loadQrToken = async () => {
      try {
        setIsLoading(true);
        setStatus("");

        let resolvedUserId = Number(storedUserId);

        if (!Number.isInteger(resolvedUserId) || resolvedUserId <= 0) {
          if (!storedEmail) {
            setStatus("Could not resolve your account. Please log in again.");
            return;
          }

          const userRes = await fetch(`${API_BASE_URL}/api/users?email=${encodeURIComponent(storedEmail)}`);
          const userData = await userRes.json().catch(() => ({}));
          if (!userRes.ok) throw new Error(userData?.message || "Could not resolve user from email");

          const candidate = Number(userData?.userId || userData?.id);
          if (!Number.isInteger(candidate) || candidate <= 0) {
            throw new Error("Could not resolve valid user ID");
          }

          resolvedUserId = candidate;
          setUserId(String(candidate));
          sessionStorage.setItem("userID", String(candidate));
          localStorage.setItem("userID", String(candidate));
        }

        const qrRes = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(resolvedUserId)}/qr-token`);
        const qrData = await qrRes.json().catch(() => ({}));
        if (!qrRes.ok) throw new Error(qrData?.message || "Failed to load QR token");

        const token = String(qrData?.qrToken || "").trim();
        if (!token) throw new Error("QR token is empty");
        setQrToken(token);
      } catch (err) {
        setQrToken("");
        setStatus(err?.message || "Failed to load QR code.");
      } finally {
        setIsLoading(false);
      }
    };

    loadQrToken();
  }, []);

  const qrImageUrl = useMemo(() => {
    if (!qrToken) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrToken)}`;
  }, [qrToken]);

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell mx-auto max-w-3xl">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Student QR</p>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">QR Code</h1>
            {email && <p className="mt-2 text-sm text-slate-600">{email}</p>}
          </div>
          <Link href="/dashboard" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
            Back to Dashboard
          </Link>
        </header>

        <section className="glass reveal-up rounded-2xl p-6 md:p-8">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading your QR code...</p>
          ) : !qrToken ? (
            <p className="text-sm text-slate-700">{status || "QR code is not available right now."}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Use this single QR code for attendance. Organizer selects an event, scans this code, and marks your check-in for that event.
              </p>

              <div className="rounded-xl border border-[var(--stroke)] bg-white p-4 flex flex-col sm:flex-row gap-4 items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt="Your student QR code"
                  className="h-[220px] w-[220px] rounded-lg border border-[var(--stroke)] bg-white"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Raw QR Value</p>
                  <p className="mt-1 break-all rounded-lg bg-[var(--surface-soft)] p-3 text-xs text-slate-700">{qrToken}</p>

                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(qrToken)}
                    className="mt-3 rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Copy Raw QR
                  </button>
                </div>
              </div>
            </div>
          )}

          {status && qrToken && <p className="mt-3 text-sm text-slate-700">{status}</p>}
        </section>
      </div>
    </main>
  );
}
