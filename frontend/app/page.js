"use client";
import Link from 'next/link';
import Image from 'next/image';

const NAV_LOGO_SRC = '/Logo.png';

export default function Home() {
  const userRole = typeof window !== 'undefined'
    ? (sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || '').toLowerCase()
    : '';

  const previewHref = userRole === 'organizer'
    ? '/dashboardO'
    : (userRole === 'student' ? '/dashboard' : '/login');
  const previewLabel = userRole ? 'Preview Your Dashboard' : 'Preview Dashboard';

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="shell">
        <nav className="glass reveal-up flex items-center justify-between rounded-2xl px-4 py-3 md:px-6 md:py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src={NAV_LOGO_SRC} alt="EventDhondo logo" width={28} height={28} />
            <p className="text-lg font-bold text-[var(--brand-strong)] md:text-2xl">EventDhondo</p>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--brand-strong)] hover:bg-[var(--surface-soft)] md:text-base">
              Login
            </Link>
            <Link href="/register" className="cta px-4 py-2 text-sm font-semibold md:text-base">
              Join Now
            </Link>
          </div>
        </nav>

        <section className="reveal-up stagger-1 mt-8 grid gap-6 md:mt-12 md:grid-cols-[1.1fr_0.9fr] md:gap-8">
          <div className="surface-card p-6 md:p-10">
            <p className="mb-3 inline-block rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold tracking-wide text-[var(--brand-strong)]">
              CAMPUS EVENT INTELLIGENCE
            </p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
              Discover What Matters
              <span className="block text-[var(--brand)]">Across Your Campus</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 md:text-lg">
              EventDhondo unifies societies, sports boards, and technical chapters into one clean event stream for students.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/register" className="cta px-5 py-3 font-semibold">Create Account</Link>
              <Link href={previewHref} className="rounded-xl border border-[var(--stroke)] bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
                {previewLabel}
              </Link>

              {/* Homepage kept minimal — dashboard links are in each dashboard's sidebar */}
            </div>
          </div>

          <div className="surface-card reveal-up stagger-2 overflow-hidden p-5 md:p-6">
            <div className="rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--brand-strong)]">Tonight&apos;s Highlights</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="font-semibold">DevHack Sprint</p>
                  <p className="text-sm text-slate-600">ACM Chapter • 7:00 PM • CS Lab 1</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="font-semibold">Basketball Trials</p>
                  <p className="text-sm text-slate-600">Sports Board • 4:00 PM • Main Court</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="font-semibold">Photography Walk</p>
                  <p className="text-sm text-slate-600">Media Club • 5:30 PM • Campus Lawn</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="reveal-up stagger-3 mt-8 grid gap-4 pb-10 md:mt-10 md:grid-cols-3 md:gap-6">
          <article className="surface-card p-5">
            <h3 className="text-lg font-bold">Central Feed</h3>
            <p className="mt-2 text-sm text-slate-600">No more hopping between random groups. All official events are in one stream.</p>
          </article>
          <article className="surface-card p-5">
            <h3 className="text-lg font-bold">Fast Registration</h3>
            <p className="mt-2 text-sm text-slate-600">Student profile, role context, and event discovery designed for quick action.</p>
          </article>
          <article className="surface-card p-5">
            <h3 className="text-lg font-bold">Career Portfolio</h3>
            <p className="mt-2 text-sm text-slate-600">Track participation and achievements in one place for your academic journey.</p>
          </article>
        </section>
      </div>

      {/* ===== Add: Features / Main goals / About (kept below existing content) ===== */}
      <section className="py-12">
        <div className="shell max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-[var(--brand-strong)] text-center">Features</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="p-5 surface-card rounded-lg shadow-sm text-justify">
              <h3 className="font-semibold text-[var(--brand-strong)] mb-2">Personalized recommendations</h3>
              <p className="text-sm text-slate-600">Events matched to your interests so you discover what's relevant quickly.</p>
            </article>

            <article className="p-5 surface-card rounded-lg shadow-sm text-justify">
              <h3 className="font-semibold text-[var(--brand-strong)] mb-2">Reminders & alerts</h3>
              <p className="text-sm text-slate-600">Automatic reminders (3 days, 1 day, 1 hour) and deadline alerts for watchlisted events.</p>
            </article>

            <article className="p-5 surface-card rounded-lg shadow-sm text-justify">
              <h3 className="font-semibold text-[var(--brand-strong)] mb-2">Organizer tools</h3>
              <p className="text-sm text-slate-600">Create and manage events, track registrations and publish updates or results.</p>
            </article>

            <article className="p-5 surface-card rounded-lg shadow-sm text-justify">
              <h3 className="font-semibold text-[var(--brand-strong)] mb-2">Notifications center</h3>
              <p className="text-sm text-slate-600">Centralized notification center with per-type preferences (email / in-app).</p>
            </article>

            <article className="p-5 surface-card rounded-lg shadow-sm text-justify">
              <h3 className="font-semibold text-[var(--brand-strong)] mb-2">QR-based attendance</h3>
              <p className="text-sm text-slate-600">Quick check-in for events using generated QR codes for students.</p>
            </article>

            <article className="p-5 surface-card rounded-lg shadow-sm text-justify">
              <h3 className="font-semibold text-[var(--brand-strong)] mb-2">Search & discover</h3>
              <p className="text-sm text-slate-600">Powerful search with filters for type, date and city — switch off personalized filter when searching broadly.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="py-12 bg-[var(--surface-soft)]">
        <div className="shell max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-[var(--brand-strong)] text-center">Main goals</h2>
          <div className="mx-auto max-w-3xl text-justify text-slate-700">
            <ol className="list-decimal list-inside space-y-3">
              <li>Increase student awareness of campus activities through personalized discovery.</li>
              <li>Reduce organizer overhead for event management, registration, and communication.</li>
              <li>Provide a reliable notification system to keep participants informed and engaged.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="shell max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-[var(--brand-strong)] text-center">About</h2>
          <div className="mx-auto max-w-3xl text-justify text-slate-700">
            <p className="mb-3">EventDhundo is a campus-focused event discovery platform built to connect students and organizers. It emphasizes relevance, low-friction event registration, and clear communication.</p>
            <p className="mb-3">Register to try personalized recommendations or browse public events without an account.</p>
          </div>
        </div>
      </section>
      {/* ===== End added sections ===== */}

    </main>
  );
}