import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="shell">
        <nav className="glass reveal-up flex items-center justify-between rounded-2xl px-4 py-3 md:px-6 md:py-4">
          <p className="text-lg font-bold text-[var(--brand-strong)] md:text-2xl">EventDhondo</p>
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
              <Link href="/dashboard" className="rounded-xl border border-[var(--stroke)] bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
                Preview Dashboard
              </Link>
            </div>
          </div>

          <div className="surface-card reveal-up stagger-2 overflow-hidden p-5 md:p-6">
            <div className="rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--brand-strong)]">Tonight's Highlights</p>
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
    </main>
  );
}