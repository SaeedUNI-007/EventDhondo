"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [location, setLocation] = useState('');
  const [linkA, setLinkA] = useState('');
  const [linkB, setLinkB] = useState('');
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');

  // per-field editing flags
  const [editing, setEditing] = useState({
    name: false,
    dob: false,
    institution: false,
    location: false,
    linkA: false,
    linkB: false
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedName = localStorage.getItem('displayName');
    const savedEmail = localStorage.getItem('userEmail');
    const savedPic = localStorage.getItem('profilePictureURL');
    const savedId = localStorage.getItem('studentId');
    const savedDob = localStorage.getItem('dateOfBirth');
    const savedInstitution = localStorage.getItem('institution');
    const savedLocation = localStorage.getItem('location');
    const savedLinkA = localStorage.getItem('linkA');
    const savedLinkB = localStorage.getItem('linkB');

    setName(savedName || 'Your Name');
    setEmail(savedEmail || 'no-reply@university.edu');
    setProfilePictureDataUrl(savedPic || '');
    setStudentId(savedId || '000000');
    setDob(savedDob || '');
    setInstitution(savedInstitution || 'Your Institution');
    setLocation(savedLocation || 'Select location');
    setLinkA(savedLinkA || '');
    setLinkB(savedLinkB || '');
  }, []);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleProfilePicture = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result.toString();
      setProfilePictureDataUrl(url);
      localStorage.setItem('profilePictureURL', url);
    };
    reader.readAsDataURL(file);
  };

  const startEdit = (field) => setEditing(prev => ({ ...prev, [field]: true }));
  const cancelEdit = (field) => {
    // revert to saved values
    const saved = {
      name: localStorage.getItem('displayName') || 'Your Name',
      dob: localStorage.getItem('dateOfBirth') || '',
      institution: localStorage.getItem('institution') || 'Your Institution',
      location: localStorage.getItem('location') || 'Select location',
      linkA: localStorage.getItem('linkA') || '',
      linkB: localStorage.getItem('linkB') || ''
    };
    if (field === 'name') setName(saved.name);
    if (field === 'dob') setDob(saved.dob);
    if (field === 'institution') setInstitution(saved.institution);
    if (field === 'location') setLocation(saved.location);
    if (field === 'linkA') setLinkA(saved.linkA);
    if (field === 'linkB') setLinkB(saved.linkB);
    setEditing(prev => ({ ...prev, [field]: false }));
  };

  const saveField = (field) => {
    if (field === 'name') localStorage.setItem('displayName', name);
    if (field === 'dob') localStorage.setItem('dateOfBirth', dob);
    if (field === 'institution') localStorage.setItem('institution', institution);
    if (field === 'location') localStorage.setItem('location', location);
    if (field === 'linkA') localStorage.setItem('linkA', linkA);
    if (field === 'linkB') localStorage.setItem('linkB', linkB);
    setEditing(prev => ({ ...prev, [field]: false }));
  };

  const handleFullSave = (e) => {
    e.preventDefault();
    localStorage.setItem('displayName', name);
    if (dob) localStorage.setItem('dateOfBirth', dob);
    if (institution) localStorage.setItem('institution', institution);
    if (location) localStorage.setItem('location', location);
    if (linkA) localStorage.setItem('linkA', linkA);
    if (linkB) localStorage.setItem('linkB', linkB);
    alert('Profile saved locally.');
  };

  const FieldRow = ({ label, value, fieldKey, editable = true, children }) => (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm font-medium text-slate-700">{label}</div>
      <div className="flex-1">
        {editing[fieldKey] ? (
          <div className="flex items-center gap-2">
            {children}
            <button type="button" onClick={() => saveField(fieldKey)} aria-label="save" className="rounded px-2 py-1 bg-emerald-600 text-white text-sm">✓</button>
            <button type="button" onClick={() => cancelEdit(fieldKey)} aria-label="cancel" className="rounded px-2 py-1 bg-white border text-sm">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-800">{value || <span className="text-slate-400">Not set</span>}</div>
            {editable && (
              <button type="button" onClick={() => startEdit(fieldKey)} aria-label={`Edit ${label}`} className="ml-3 inline-flex items-center p-1 rounded hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

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

                <button type="button" onClick={openFilePicker} className="absolute -right-1 -bottom-1 bg-white border rounded-full p-2 shadow-sm" aria-label="Change profile picture">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8.414A2 2 0 0016.414 7L13 3.586A2 2 0 0011.586 3H4z" />
                  </svg>
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleProfilePicture(e.target.files?.[0])} className="hidden" />
              </div>

              <div className="mt-3 text-center text-sm text-slate-600">Profile Picture</div>
            </div>

            <div className="space-y-4">
              <FieldRow label="Name:" value={name} fieldKey="name" editable>
                <input className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full" value={name} onChange={(e) => setName(e.target.value)} />
              </FieldRow>

              <FieldRow label="ID:" value={studentId} fieldKey="studentId" editable={false}>
                {/* non-editable */}
              </FieldRow>

              <FieldRow label="Date of Birth:" value={dob ? new Date(dob).toLocaleDateString() : ''} fieldKey="dob" editable>
                <input type="date" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" value={dob} onChange={(e) => setDob(e.target.value)} />
              </FieldRow>

              <FieldRow label="E-mail:" value={email} fieldKey="email" editable={false}>
                {/* non-editable */}
              </FieldRow>

              <FieldRow label="Institution:" value={institution} fieldKey="institution" editable>
                <input className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full" value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </FieldRow>

              <FieldRow label="Location:" value={location} fieldKey="location" editable>
                <select className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5" value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="">Select location</option>
                  <option value="Campus A">Campus A</option>
                  <option value="Campus B">Campus B</option>
                  <option value="Remote">Remote</option>
                </select>
              </FieldRow>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">Link Tree (optional)</div>
                <div className="space-y-2">
                  <FieldRow label="Linkdlin:" value={linkA} fieldKey="linkA" editable>
                    <input placeholder="Facebook / LinkedIn / Instagram URL" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full" value={linkA} onChange={(e) => setLinkA(e.target.value)} />
                  </FieldRow>

                  <FieldRow label="Github:" value={linkB} fieldKey="linkB" editable>
                    <input placeholder="Other link" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full" value={linkB} onChange={(e) => setLinkB(e.target.value)} />
                  </FieldRow>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button type="submit" className="cta px-4 py-2 font-semibold">Save Profile</button>
                <Link href="/" className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]">Cancel</Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}