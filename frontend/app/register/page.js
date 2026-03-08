"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Register() {
  const [role, setRole] = useState('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [yearOfStudy, setYearOfStudy] = useState('1');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (role === 'organizer') {
      setError('Organizer registration is not available yet in the backend. Please use Student for now.');
      return;
    }

    const numericYear = Number(yearOfStudy);
    if (!Number.isInteger(numericYear) || numericYear < 1 || numericYear > 4) {
      setError('Year of Study must be between 1 and 4 for BS degree.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
        departmentId: department,
        yearOfStudy: numericYear,
      };

      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Registration failed');
        return;
      }

      setSuccess('Registration successful. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError('Server connection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[0.95fr_1.05fr]">
        <section className="surface-card reveal-up hidden p-8 md:block">
          <p className="inline-block rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">NEW HERE</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight">Create Your Event Identity</h1>
          <p className="mt-4 text-slate-600">Join EventDhondo to find technical competitions, sports events, and portfolio-worthy opportunities around campus.</p>
          <div className="mt-8 space-y-3 text-sm text-slate-700">
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">Verified student onboarding</div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">Role-based event recommendations</div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">One place for registrations and achievements</div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="glass reveal-up stagger-1 w-full rounded-2xl p-6 md:p-8">
          <h2 className="text-3xl font-bold text-[var(--brand-strong)]">Create Account</h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">Student registration is active on backend</p>

          {error && <p className="mb-4 rounded-lg bg-rose-50 p-2 text-center text-sm text-[var(--danger)]">{error}</p>}
          {success && <p className="mb-4 rounded-lg bg-emerald-50 p-2 text-center text-sm text-emerald-700">{success}</p>}
        
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-soft)] p-1.5">
            <button type="button" onClick={() => setRole('student')} className={`rounded-lg p-2 text-sm font-semibold ${role === 'student' ? 'bg-white text-[var(--brand-strong)] shadow-sm' : 'text-slate-600'}`}>Student</button>
            <button type="button" onClick={() => setRole('organizer')} className={`rounded-lg p-2 text-sm font-semibold ${role === 'organizer' ? 'bg-white text-[var(--brand-strong)] shadow-sm' : 'text-slate-600'}`}>Organizer</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <input className="mt-3 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" type="email" placeholder="University Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="mb-3 mt-3 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {role === 'student' ? (
            <>
              <select className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="Computer Science">Computer Science</option>
                <option value="Software Engineering">Software Engineering</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
              </select>
              <label className="mt-3 block text-sm font-semibold text-slate-700">Year of Study (BS: 1-4)</label>
              <input className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" type="number" min="1" max="4" placeholder="Enter 1 to 4" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} required />
            </>
          ) : (
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-200" type="text" placeholder="Society Name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
          )}

          <button disabled={isSubmitting} className="cta mt-5 w-full py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>

          <p className="mt-4 text-center text-sm text-slate-600">
            Already have an account? <Link href="/login" className="font-semibold text-[var(--brand-strong)] hover:underline">Login here</Link>
          </p>
        </form>
      </div>
    </main>
  );
}