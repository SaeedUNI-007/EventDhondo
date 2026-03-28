"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NAV_LOGO_SRC = '/Logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Action: Call POST /api/auth/login 
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Keep active auth in sessionStorage so different tabs can use different accounts.
        const resolvedUserId = String(data.userId ?? data.userID ?? '');
        const resolvedRole = String(data.role || 'Student');

        sessionStorage.setItem('userID', resolvedUserId);
        sessionStorage.setItem('userId', resolvedUserId);
        sessionStorage.setItem('userRole', resolvedRole);
        sessionStorage.setItem('userEmail', email);

        // Scoped profile cache can remain in localStorage.
        localStorage.setItem(`userEmail:${resolvedUserId}`, email);
        localStorage.setItem('token', data.token);
        const guessedName = email.split('@')[0].replace(/[._-]+/g, ' ');
        const titleCaseName = guessedName.replace(/\b\w/g, (c) => c.toUpperCase());
        const safeDisplayName = titleCaseName || 'Student';
        sessionStorage.setItem('displayName', safeDisplayName);
        localStorage.setItem(`displayName:${resolvedUserId}`, safeDisplayName);

        if (resolvedRole.toLowerCase() === 'admin') {
          router.push('/dashboardA');
        } else if (resolvedRole.toLowerCase() === 'organizer') {
          router.push('/dashboardO');
        } else {
          router.push('/dashboard');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server connection failed');
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <nav className="glass reveal-up mx-auto mb-6 flex max-w-5xl items-center justify-between rounded-2xl px-4 py-3 md:px-6 md:py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src={NAV_LOGO_SRC} alt="EventDhondo logo" width={28} height={28} />
          <p className="text-lg font-bold text-[var(--brand-strong)] md:text-2xl">EventDhondo</p>
        </Link>
        <Link href="/" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
          Back to Home
        </Link>
      </nav>
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-card reveal-up hidden p-8 md:block">
          <p className="inline-block rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">WELCOME BACK</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900">Continue Your Campus Journey</h1>
          <p className="mt-4 text-slate-600">Sign in to discover upcoming events, sports trials, workshops, and competitions from verified societies.</p>
          <div className="mt-8 rounded-2xl bg-[var(--surface-soft)] p-4 text-sm text-slate-700">
            <p className="font-semibold text-[var(--brand-strong)]">Tip</p>
            <p className="mt-1">Use the same credentials you created in Register. Backend auth uses `email + password` from your SQL database.</p>
          </div>
        </section>

        <section className="glass reveal-up stagger-1 w-full rounded-2xl p-6 md:p-8">
          <h2 className="text-3xl font-bold text-[var(--brand-strong)]">Login</h2>
          <p className="mb-6 mt-1 text-sm text-slate-600">Access your EventDhondo account</p>
        
          {error && <p className="mb-4 rounded-lg bg-rose-50 p-2 text-center text-sm text-[var(--danger)]">{error}</p>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200"
                placeholder="you@fast.edu.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
              <input
                type="password"
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="cta w-full py-2.5 font-semibold">
              Login
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            Don&apos;t have an account? <Link href="/register" className="font-semibold text-[var(--brand-strong)] hover:underline">Register here</Link>
          </p>
        </section>
      </div>
    </main>
  );
}