"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const MAX_PROFILE_PICTURE_BYTES = 1024 * 1024;
const NAV_LOGO_SRC = '/Logo.png';

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
  const [dob, setDob] = useState('');
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');
  const [interests, setInterests] = useState([]);
  const [showInterests, setShowInterests] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Fetch interests from DB on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/interests`)
      .then(res => res.json())
      .then(data => setAllAvailableInterests(data))
      .catch(err => console.error("Failed to fetch interests", err));
  }, []);

  const PROGRAM_OPTIONS = [
    "BS - CS", "BS - SE", "BS - DS", "BS - AI", "BS - CyberSecurity", "BS - Business",
    "BSc - CS", "BSc - Data Science", "BA - Business", "BBA - Business", "MBA - Business",
    "MS - CS", "MS - AI", "MS - Data Science", "MS - CyberSecurity", "MS - Business Analytics", "PhD - CS"
  ];

  const PROGRAM_SUGGESTIONS = {
    "BS - CS": { interests: ["Competitive Programming", "Web Development"] },
    "BS - SE": { interests: ["Fullstack Project", "REST API Design"] },
    "BS - DS": { interests: ["Data Science", "Big Data / Hadoop / Spark"] },
    "BS - AI": { interests: ["AI / Machine Learning", "Deep Learning"] },
    "BS - CyberSecurity": { interests: ["Cybersecurity / CTF"] },
    "BS - Business": { interests: ["Product Management / Startup Pitch", "Business Case Competitions"] },
    "BBA - Business": { interests: ["Business Case Competitions", "Entrepreneurship / Startup Pitch"] },
    "MBA - Business": { interests: ["Business Case Competitions", "Entrepreneurship / Startup Pitch"] },
    "MS - CS": { interests: ["Research Seminars", "Seminars / Guest Lectures"] },
    "MS - AI": { interests: ["AI / Machine Learning", "NLP (Natural Language Processing)"] },
    "MS - Data Science": { interests: ["Data Science", "Big Data / Hadoop / Spark"] },
    "MS - CyberSecurity": { interests: ["Cybersecurity / CTF"] },
    "MS - Business Analytics": { interests: ["Business Case Competitions"] },
    "PhD - CS": { interests: ["Research Seminars"] }
  };

  const toggleInterest = (type) => {
    setInterests(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]));
  };

  const removeInterest = (type) => setInterests(prev => prev.filter(t => t !== type));

  const handleProfilePicture = (file) => {
    if (!file) { setProfilePictureDataUrl(''); return; }
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
    const suggestions = PROGRAM_SUGGESTIONS[p] || { interests: [] };
    const validSuggestions = suggestions.interests.filter(s => 
      allAvailableInterests.some(item => item.InterestName === s)
    );
    setInterests(prev => Array.from(new Set([...prev, ...validSuggestions])));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!email || !password) { setError('Email and password are required.'); return; }

    if (role === 'student') {
      if (!firstName.trim() || !lastName.trim()) { setError('First name and last name are required for students.'); return; }
      const numericYear = Number(yearOfStudy);
      if (!Number.isInteger(numericYear) || numericYear < 1 || numericYear > 8) { setError('Year of Study must be an integer between 1 and 8.'); return; }
      if (dob && isNaN(Date.parse(dob))) { setError('DOB is not a valid date.'); return; }
    } else {
      if (!organizationName.trim() || !contactEmail.trim()) { setError('Organization name and contact email are required for organizers.'); return; }
    }

    try {
      setIsSubmitting(true);
      const [degreeLevel, subject] = program.split(' - ').map(s => s.trim());
      const payload = {
        email,
        password,
        role,
        interests,
        studentProfile: null,
        organizerProfile: null
      };

      if (role === 'student') {
        payload.studentProfile = { firstName: firstName.trim(), lastName: lastName.trim(), department: subject || null, degree: degreeLevel || null, yearOfStudy: Number(yearOfStudy) || null, dateOfBirth: dob || null, profilePictureURL: profilePictureDataUrl || null };
      } else {
        payload.organizerProfile = { organizationName: organizationName.trim(), description: organizationDescription.trim() || null, contactEmail: contactEmail.trim(), profilePictureURL: profilePictureDataUrl || null };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) { setError(data.message || 'Registration failed.'); return; }

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
      </nav>
      
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="glass reveal-up stagger-1 w-full rounded-2xl p-6 md:p-8">
          <h2 className="text-3xl font-bold text-[var(--brand-strong)]">Create Account</h2>
          {/* ... (Keep your existing form fields here) ... */}
          
          <div className="mt-3">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Interests</label>
            <button type="button" className="mb-2 rounded-md bg-white px-3 py-2 border" onClick={() => setShowInterests(!showInterests)}>
              {interests.length ? `${interests.length} selected` : 'Choose interests'}
            </button>
            {showInterests && (
              <div className="grid max-h-60 overflow-auto gap-2 rounded-xl border border-[var(--stroke)] bg-white p-3">
                {allAvailableInterests.map((item) => (
                  <label key={item.InterestID} className="flex items-center gap-2">
                    <input type="checkbox" checked={interests.includes(item.InterestName)} onChange={() => toggleInterest(item.InterestName)} className="h-4 w-4" />
                    <span className="text-sm">{item.InterestName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          
          <button disabled={isSubmitting} className="cta mt-5 w-full py-2.5 font-semibold">
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </main>
  );
}