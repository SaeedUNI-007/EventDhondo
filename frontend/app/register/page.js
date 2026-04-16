"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import RegisterBranding from '@/components/RegisterBranding';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const MAX_PROFILE_PICTURE_BYTES = 1024 * 1024;
const NAV_LOGO_SRC = '/Logo.png';
const ALLOWED_CITIES = ['Lahore', 'Islamabad', 'Karachi'];

export default function Register() {
  const [allAvailableInterests, setAllAvailableInterests] = useState([]);
  const [role, setRole] = useState('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationDescription, setOrganizationDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState('BS - CS');
  const [yearOfStudy, setYearOfStudy] = useState('1');
  const [studentCity, setStudentCity] = useState('Lahore');
  const [organizerCity, setOrganizerCity] = useState('Lahore');
  const [dob, setDob] = useState('');
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');
  const [interests, setInterests] = useState([]);
  const [showInterests, setShowInterests] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/interests`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch interests');
        }
        setAllAvailableInterests(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch interests:', err);
      }
    };

    fetchInterests();
  }, []);

  const PROGRAM_OPTIONS = [
    'BS - CS',
    'BS - SE',
    'BS - DS',
    'BS - AI',
    'BS - CyberSecurity',
    'BS - Business',
    'BSc - CS',
    'BSc - Data Science',
    'BA - Business',
    'BBA - Business',
    'MBA - Business',
    'MS - CS',
    'MS - AI',
    'MS - Data Science',
    'MS - CyberSecurity',
    'MS - Business Analytics',
    'PhD - CS'
  ];

  const PROGRAM_SUGGESTIONS = {
    'BS - CS': { interests: ['Coding Contest / Competitive Programming', 'Web Development'] },
    'BS - SE': { interests: ['Fullstack Project', 'REST API Design'] },
    'BS - DS': { interests: ['Data Science', 'Big Data / Hadoop / Spark'] },
    'BS - AI': { interests: ['AI / Machine Learning', 'Deep Learning'] },
    'BS - CyberSecurity': { interests: ['Cybersecurity / CTF'] },
    'BS - Business': { interests: ['Product Management / Startup Pitch', 'Business Case Competitions'] },
    'BBA - Business': { interests: ['Business Case Competitions', 'Entrepreneurship / Startup Pitch'] },
    'MBA - Business': { interests: ['Business Case Competitions', 'Entrepreneurship / Startup Pitch'] },
    'MS - CS': { interests: ['Research Seminars', 'Seminars / Guest Lectures'] },
    'MS - AI': { interests: ['AI / Machine Learning', 'NLP (Natural Language Processing)'] },
    'MS - Data Science': { interests: ['Data Science', 'Big Data / Hadoop / Spark'] },
    'MS - CyberSecurity': { interests: ['Cybersecurity / CTF'] },
    'MS - Business Analytics': { interests: ['Business Case Competitions'] },
    'PhD - CS': { interests: ['Research Seminars'] }
  };

  const toggleInterest = (type) => {
    setInterests((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const removeInterest = (type) => setInterests((prev) => prev.filter((t) => t !== type));

  const handleProfilePicture = (file) => {
    if (!file) {
      setProfilePictureDataUrl('');
      return;
    }

    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
      setError('Profile picture is too large. Please choose an image under 1 MB.');
      setProfilePictureDataUrl('');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => setProfilePictureDataUrl(reader.result.toString());
    reader.readAsDataURL(file);
  };

  const onProgramChange = (p) => {
    setProgram(p);

    const dbInterestNames = new Set(allAvailableInterests.map((item) => item.InterestName));
    const suggested = (PROGRAM_SUGGESTIONS[p]?.interests || []).filter((name) => dbInterestNames.has(name));

    setInterests((prev) => Array.from(new Set([...prev, ...suggested])));
  };

  const orderedTypes = [
    ...interests,
    ...allAvailableInterests
      .map((item) => item.InterestName)
      .filter((name) => !interests.includes(name))
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (role === 'student') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('First name and last name are required for students.');
        return;
      }

      if (!studentCity.trim()) {
        setError('City is required for students.');
        return;
      }

      const numericYear = Number(yearOfStudy);
      if (!Number.isInteger(numericYear) || numericYear < 1 || numericYear > 8) {
        setError('Year of Study must be an integer between 1 and 8.');
        return;
      }

      if (dob && isNaN(Date.parse(dob))) {
        setError('DOB is not a valid date.');
        return;
      }
    } else if (!organizationName.trim() || !contactEmail.trim()) {
      setError('Organization name and contact email are required for organizers.');
      return;
    } else if (!organizerCity.trim()) {
      setError('City is required for organizers.');
      return;
    }

    try {
      setIsSubmitting(true);
      const [degreeLevel, subject] = program.split(' - ').map((s) => s.trim());

      const payload = {
        email,
        password,
        role,
        interests,
        studentProfile: null,
        organizerProfile: null
      };

      if (role === 'student') {
        payload.studentProfile = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          department: subject || null,
          city: studentCity.trim() || null,
          degree: degreeLevel || null,
          yearOfStudy: Number(yearOfStudy) || null,
          dateOfBirth: dob || null,
          profilePictureURL: profilePictureDataUrl || null
        };
      } else {
        payload.organizerProfile = {
          organizationName: organizationName.trim(),
          description: organizationDescription.trim() || null,
          contactEmail: contactEmail.trim(),
          city: organizerCity.trim() || null,
          profilePictureURL: profilePictureDataUrl || null
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Registration failed.');
        return;
      }

      setSuccess('Registration successful. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError('Server connection failed.');
    } finally {
      setIsSubmitting(false);
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

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[0.95fr_1.05fr]">
        <RegisterBranding />

        <form onSubmit={handleSubmit} className="glass reveal-up stagger-1 w-full rounded-2xl p-6 md:p-8">
          <h2 className="text-3xl font-bold text-[var(--brand-strong)]">Create Account</h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">Student and Organizer registration</p>

          {error && <p className="mb-4 rounded-lg bg-rose-50 p-2 text-center text-sm text-[var(--danger)]">{error}</p>}
          {success && <p className="mb-4 rounded-lg bg-emerald-50 p-2 text-center text-sm text-emerald-700">{success}</p>}

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-soft)] p-1.5">
            <button type="button" onClick={() => setRole('student')} className={`rounded-lg p-2 text-sm font-semibold ${role === 'student' ? 'bg-white text-[var(--brand-strong)] shadow-sm' : 'text-slate-600'}`}>
              Student
            </button>
            <button type="button" onClick={() => setRole('organizer')} className={`rounded-lg p-2 text-sm font-semibold ${role === 'organizer' ? 'bg-white text-[var(--brand-strong)] shadow-sm' : 'text-slate-600'}`}>
              Organizer
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {role === 'student' ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">First Name</label>
                  <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Last Name</label>
                  <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Organization Name</label>
                  <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="text" placeholder="Organization Name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Contact Email</label>
                  <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="email" placeholder="Contact Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
                </div>
              </>
            )}
          </div>

          <label className="mt-3 block text-sm font-semibold text-slate-700">City</label>
          <select
            className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5"
            value={role === 'student' ? studentCity : organizerCity}
            onChange={(e) => role === 'student' ? setStudentCity(e.target.value) : setOrganizerCity(e.target.value)}
            required
          >
            {ALLOWED_CITIES.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <label className="mt-3 block text-sm font-semibold text-slate-700">University E-mail</label>
          <input className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="email" placeholder="University Email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label className="mb-1 mt-3 block text-sm font-semibold text-slate-700">Password</label>
          <input className="mb-3 mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {role === 'student' && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Degree and Subject</label>
                  <select className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" value={program} onChange={(e) => onProgramChange(e.target.value)}>
                    {PROGRAM_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Choose the exact program (e.g. &quot;BS - CS&quot;, &quot;MBA - Business&quot;)</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Academic Year</label>
                  <input className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="number" min="1" max="8" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} placeholder="Enter numeric year (e.g., 1 for 1st year)" />
                  <p className="mt-1 text-xs text-slate-500">Enter numeric year of your program (for multi-year degrees enter the year number)</p>
                </div>
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">Date of Birth</label>
              <input className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </>
          )}

          {role === 'organizer' && (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-slate-700">Organization Description (optional)</label>
              <textarea className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" rows={3} value={organizationDescription} onChange={(e) => setOrganizationDescription(e.target.value)} />
            </div>
          )}

          <div className="mt-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Interests</label>
            <button type="button" className="mb-2 rounded-md border bg-white px-3 py-2" onClick={() => setShowInterests((s) => !s)}>
              {interests.length ? `${interests.length} selected` : 'Choose interests'}
            </button>

            {showInterests && (
              <div className="grid max-h-60 gap-2 overflow-auto rounded-xl border border-[var(--stroke)] bg-white p-3">
                {orderedTypes.map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input type="checkbox" checked={interests.includes(type)} onChange={() => toggleInterest(type)} className="h-4 w-4" />
                    <span className={`text-sm ${interests.includes(type) ? 'font-semibold' : ''}`}>{type}</span>
                  </label>
                ))}
              </div>
            )}

            {interests.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {interests.map((t) => (
                  <div key={t} className="flex items-center gap-2 rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm">
                    <span className="max-w-[14rem] truncate">{t}</span>
                    <button type="button" onClick={() => removeInterest(t)} className="ml-1 rounded-full px-1 text-xs text-rose-600">x</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Profile Picture (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => handleProfilePicture(e.target.files?.[0])} />
            {profilePictureDataUrl && (
              <Image
                src={profilePictureDataUrl}
                alt="preview"
                width={80}
                height={80}
                className="mt-2 h-20 w-20 rounded-md object-cover"
                unoptimized
              />
            )}
          </div>

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
