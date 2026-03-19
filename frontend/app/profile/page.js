"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
  const [linkedIn, setLinkedIn] = useState(''); // Updated
  const [gitHub, setGitHub] = useState('');     // Updated
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');
  const [status, setStatus] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    const userId = localStorage.getItem('userID') || localStorage.getItem('userId');
    setCurrentUserId(userId || '');

    const fetchProfile = async () => {
      if (!userId) return;
      try {
        setStatus('Loading profile...');
        const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`);
        const data = await res.json();
        
        if (res.ok && data) {
          setName(`${data.FirstName || ''} ${data.LastName || ''}`.trim());
          setEmail(data.Email || '');
          setInstitution(data.Department || '');
          setStudentId(String(data.UserID || userId));
          setLinkedIn(data.LinkedInURL || '');
          setGitHub(data.GitHubURL || '');
          setProfilePictureDataUrl(data.ProfilePictureURL || '');
        }
        setStatus('');
      } catch (err) {
        setStatus('Could not fetch profile from server');
      }
    };
    fetchProfile();
  }, []);

  const handleFullSave = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem('userID') || localStorage.getItem('userId');
    const [firstName, ...rest] = name.trim().split(/\s+/);

    try {
      setStatus('Saving profile...');
      const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'student',
          firstName: firstName || '',
          lastName: rest.join(' ') || 'N/A',
          department: institution,
          linkedInURL: linkedIn,
          gitHubURL: gitHub,
          profilePictureURL: profilePictureDataUrl
        })
      });

      if (!res.ok) throw new Error('Failed to save profile');
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
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Your Profile</h1>
            <Link href="/dashboard" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Dashboard</Link>
          </div>
        </header>

        <form onSubmit={handleFullSave} className="glass reveal-up w-full rounded-2xl p-6 md:p-8">
          {status && <p className="mb-4 rounded-lg bg-[var(--surface-soft)] p-2 text-sm text-center text-slate-700">{status}</p>}
          <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-6 items-start">
            {/* Picture Section */}
            <div className="flex flex-col items-center">
              <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--surface-soft)] flex items-center justify-center">
                {profilePictureDataUrl ? <img src={profilePictureDataUrl} alt="Profile" className="h-full w-full object-cover" /> : <span className="text-2xl text-slate-600">{name.charAt(0) || 'P'}</span>}
              </div>
            </div>

            <div className="space-y-4">
              <FieldRow label="Name:" value={name} editable={isEditing}>
                <input disabled={!isEditing} className="w-full p-2 border rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
              </FieldRow>

              <FieldRow label="Department:" value={institution} editable={isEditing}>
                <input disabled={!isEditing} className="w-full p-2 border rounded-xl" value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </FieldRow>

              <div className="pt-4 border-t">
                <div className="text-sm font-semibold text-slate-700 mb-3">Professional Links</div>
                <div className="space-y-3">
                  <FieldRow label="LinkedIn:" value={linkedIn} editable={isEditing}>
                    <input disabled={!isEditing} placeholder="LinkedIn URL" className="w-full p-2 border rounded-xl" value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} />
                  </FieldRow>
                  <FieldRow label="GitHub:" value={gitHub} editable={isEditing}>
                    <input disabled={!isEditing} placeholder="GitHub URL" className="w-full p-2 border rounded-xl" value={gitHub} onChange={(e) => setGitHub(e.target.value)} />
                  </FieldRow>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="cta px-4 py-2">Edit Profile</button>
                ) : (
                  <>
                    <button type="submit" className="cta px-4 py-2">Save Profile</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded">Cancel</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}