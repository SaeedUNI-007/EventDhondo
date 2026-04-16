"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ALLOWED_CITIES = ['Lahore', 'Islamabad', 'Karachi'];

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

function FieldRow({ label, value, editable = true, children }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm font-medium text-slate-700">{label}</div>
      <div className="flex-1">
        {editable ? children : <div className="text-sm text-slate-800">{value || <span className="text-slate-400">Not set</span>}</div>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('Lahore');
  const [linkA, setLinkA] = useState('');
  const [linkB, setLinkB] = useState('');
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');
  const [status, setStatus] = useState('');

  const readScopedValue = (key, fallback = '') => {
    if (typeof window === 'undefined') return fallback;

    if (currentUserId) {
      const scopedValue = localStorage.getItem(`${key}:${currentUserId}`);
      if (scopedValue !== null) return scopedValue;
      return fallback;
    }

    const legacyValue = localStorage.getItem(key);
    return legacyValue !== null ? legacyValue : fallback;
  };

  const writeScopedValue = (key, value) => {
    if (typeof window === 'undefined' || !currentUserId) return;
    const storageKey = `${key}:${currentUserId}`;
    if (value === null || value === undefined || value === '') {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, String(value));
  };

  const fileInputRef = useRef(null);

  useEffect(() => {
    const userId = sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId');
    setCurrentUserId(userId || '');

    const readInitial = (key, fallback = '') => {
      if (userId) {
        const scopedValue = localStorage.getItem(`${key}:${userId}`);
        if (scopedValue !== null) return scopedValue;
        return fallback;
      }
      const legacyValue = localStorage.getItem(key);
      return legacyValue !== null ? legacyValue : fallback;
    };

    const savedName = readInitial('displayName');
    const savedEmail = readInitial('userEmail', 'no-reply@university.edu');
    const savedPic = readInitial('profilePictureURL');
    const savedId = readInitial('studentId') || userId;
    const savedDob = readInitial('dateOfBirth');
    const savedInstitution = readInitial('institution', 'FAST NUCES');
    const savedCity = readInitial('city', 'Lahore');
    const savedLinkA = readInitial('linkA');
    const savedLinkB = readInitial('linkB');

    setName(savedName || 'Your Name');
    setEmail(savedEmail || 'no-reply@university.edu');
    setProfilePictureDataUrl(savedPic || '');
    setStudentId(savedId || '000000');
    setDob(savedDob || '');
    setInstitution(savedInstitution || 'FAST NUCES');
    setCity(savedCity || 'Lahore');
    setLinkA(savedLinkA || '');
    setLinkB(savedLinkB || '');

    const fetchProfile = async () => {
      if (!userId) return;
      try {
        setStatus('Loading profile...');
        const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': String(userId),
          },
        });
        const data = await res.json();

        if (!res.ok || !data) {
          throw new Error(data?.message || 'Failed to load profile');
        }

        const fullName = [data.FirstName, data.LastName].filter(Boolean).join(' ').trim();
        const resolvedName = fullName || savedName || 'Your Name';
        const resolvedEmail = data.Email || savedEmail || 'no-reply@university.edu';
        const resolvedPic = data.ProfilePictureURL || savedPic || '';
        const resolvedInstitution = data.Department || savedInstitution || 'FAST NUCES';
        const resolvedCity = data.City || savedCity || 'Lahore';
        const resolvedStudentId = String(data.UserID || userId);
        const resolvedDob = toDateInputValue(data.DateOfBirth) || savedDob || '';
        const resolvedLinkedIn = data.LinkedInURL || savedLinkA || '';
        const resolvedGitHub = data.GitHubURL || savedLinkB || '';

        setName(resolvedName);
        setEmail(resolvedEmail);
        setProfilePictureDataUrl(resolvedPic);
        setInstitution(resolvedInstitution);
        setCity(resolvedCity);
        setStudentId(resolvedStudentId);
        setDob(resolvedDob);
        setLinkA(resolvedLinkedIn);
        setLinkB(resolvedGitHub);

        localStorage.setItem(`displayName:${userId}`, resolvedName);
        localStorage.setItem(`userEmail:${userId}`, resolvedEmail);
        localStorage.setItem(`profilePictureURL:${userId}`, resolvedPic);
        localStorage.setItem(`institution:${userId}`, resolvedInstitution);
        localStorage.setItem(`city:${userId}`, resolvedCity);
        localStorage.setItem(`studentId:${userId}`, resolvedStudentId);
        localStorage.setItem(`dateOfBirth:${userId}`, resolvedDob);
        localStorage.setItem(`linkA:${userId}`, resolvedLinkedIn);
        localStorage.setItem(`linkB:${userId}`, resolvedGitHub);

        sessionStorage.setItem('displayName', resolvedName);
        sessionStorage.setItem('userEmail', resolvedEmail);
        localStorage.setItem('displayName', resolvedName);
        localStorage.setItem('userEmail', resolvedEmail);
        localStorage.setItem('city', resolvedCity);
        localStorage.setItem('profilePictureURL', resolvedPic);

        setStatus('');
      } catch (err) {
        setStatus(err.message || 'Could not fetch profile from server');
      }
    };

    fetchProfile();
  }, []);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleProfilePicture = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result.toString();
      setProfilePictureDataUrl(url);
      writeScopedValue('profilePictureURL', url);
    };
    reader.readAsDataURL(file);
  };

  const resetFromScopedStorage = () => {
    setName(readScopedValue('displayName', 'Your Name'));
    setDob(readScopedValue('dateOfBirth', ''));
    setInstitution(readScopedValue('institution', 'FAST NUCES'));
    setCity(readScopedValue('city', 'Lahore'));
    setLinkA(readScopedValue('linkA', ''));
    setLinkB(readScopedValue('linkB', ''));
    setProfilePictureDataUrl(readScopedValue('profilePictureURL', ''));
  };

  const handleFullSave = async (e) => {
    e.preventDefault();
    const userId = sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId');
    sessionStorage.setItem('displayName', name);
    if (email) sessionStorage.setItem('userEmail', email);
    localStorage.setItem('displayName', name);
    if (email) localStorage.setItem('userEmail', email);
    localStorage.setItem('city', city || '');
    writeScopedValue('displayName', name);
    writeScopedValue('dateOfBirth', dob || '');
    writeScopedValue('institution', institution || '');
    writeScopedValue('city', city || '');
    writeScopedValue('linkA', linkA || '');
    writeScopedValue('linkB', linkB || '');
    writeScopedValue('profilePictureURL', profilePictureDataUrl || '');

    if (!userId) {
      alert('Profile saved locally. Please login again to sync with backend.');
      return;
    }

    try {
      setStatus('Saving profile...');
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(' ') || 'N/A';
      const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify({
          role: 'student',
          firstName: firstName || null,
          lastName,
          department: institution || null,
          city: city || null,
          year: null,
          dateOfBirth: dob || null,
          linkedInURL: linkA || null,
          gitHubURL: linkB || null,
          profilePictureURL: profilePictureDataUrl || null
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save profile');
      }

      setStatus('Profile saved successfully.');
      setIsEditing(false);
    } catch (err) {
      setStatus(err.message || 'Profile save failed');
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell max-w-5xl mx-auto">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Your Profile</h1>
            </div>
            <Link href="/dashboard" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Dashboard</Link>
          </div>
        </header>

        <form onSubmit={handleFullSave} className="glass reveal-up w-full rounded-2xl p-6 md:p-8">
          {status && <p className="mb-4 rounded-lg bg-[var(--surface-soft)] p-2 text-sm text-slate-700">{status}</p>}
          <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--surface-soft)] flex items-center justify-center">
                  {profilePictureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePictureDataUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl text-slate-600">{(name && name.charAt(0)) || 'P'}</span>
                  )}
                </div>

                <button type="button" onClick={openFilePicker} disabled={!isEditing} className="absolute -right-1 -bottom-1 bg-white border rounded-full p-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60" aria-label="Change profile picture">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8.414A2 2 0 0016.414 7L13 3.586A2 2 0 0011.586 3H4z" />
                  </svg>
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleProfilePicture(e.target.files?.[0])} className="hidden" />
              </div>

              <div className="mt-3 text-center text-sm text-slate-600">Profile Picture</div>
            </div>

            <div className="space-y-4">
              <FieldRow label="Name:" value={name} editable>
                <input disabled={!isEditing} className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={name} onChange={(e) => setName(e.target.value)} />
              </FieldRow>

              <FieldRow label="ID:" value={studentId} editable={false}>
                {/* non-editable */}
              </FieldRow>

              <FieldRow label="Date of Birth:" value={dob ? new Date(dob).toLocaleDateString() : ''} editable>
                <input disabled={!isEditing} type="date" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 disabled:bg-slate-50 disabled:text-slate-500" value={dob} onChange={(e) => setDob(e.target.value)} />
              </FieldRow>

              <FieldRow label="E-mail:" value={email} editable={false}>
                {/* non-editable */}
              </FieldRow>

              <FieldRow label="Department:" value={institution} editable>
                <input disabled={!isEditing} className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </FieldRow>

              <FieldRow label="City:" value={city} editable>
                <select disabled={!isEditing} className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={city} onChange={(e) => setCity(e.target.value)}>
                  {ALLOWED_CITIES.map((cityOption) => (
                    <option key={cityOption} value={cityOption}>{cityOption}</option>
                  ))}
                </select>
              </FieldRow>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">Link Tree (optional)</div>
                <div className="space-y-2">
                  <FieldRow label="LinkedIn:" value={linkA} editable>
                    <input disabled={!isEditing} placeholder="LinkedIn URL" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={linkA} onChange={(e) => setLinkA(e.target.value)} />
                  </FieldRow>

                  <FieldRow label="GitHub:" value={linkB} editable>
                    <input disabled={!isEditing} placeholder="GitHub URL" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={linkB} onChange={(e) => setLinkB(e.target.value)} />
                  </FieldRow>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="cta px-4 py-2 font-semibold">Edit Profile</button>
                ) : (
                  <>
                    <button type="submit" className="cta px-4 py-2 font-semibold">Save Profile</button>
                    <button
                      type="button"
                      onClick={() => {
                        resetFromScopedStorage();
                        setIsEditing(false);
                        setStatus('');
                      }}
                      className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]"
                    >
                      Cancel Edit
                    </button>
                  </>
                )}
                <Link href="/" className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]">Cancel</Link>
              </div>

              <div className="mt-6 rounded-xl border border-[var(--stroke)] bg-white p-4">
                <h3 className="text-base font-bold text-slate-900">Attendance QR</h3>
                <p className="mt-2 text-sm text-slate-600">Use your single QR from the QR Code tab in dashboard for all event check-ins.</p>
                <Link href="/qr-code" className="mt-3 inline-block rounded border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
                  Open QR Code Page
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
