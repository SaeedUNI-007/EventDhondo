"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const ALLOWED_CITIES = ['Lahore', 'Islamabad', 'Karachi'];

export default function ProfileO() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [orgName, setOrgName] = useState("Organization Name");
  const [description, setDescription] = useState("Not set");
  const [contactEmail, setContactEmail] = useState("no-reply@organization.org");
  const [city, setCity] = useState("Lahore");
  const [verification, setVerification] = useState("Pending");
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef(null);

  const resolveOrganizerId = async () => {
    const storedUserId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId") || "";
    if (Number.isInteger(Number(storedUserId)) && Number(storedUserId) > 0) {
      return String(Number(storedUserId));
    }

    const storedEmail = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "";
    if (!storedEmail) return "";

    const res = await fetch(`${API_BASE_URL}/api/users?email=${encodeURIComponent(storedEmail)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || "Could not resolve organizer account");
    }

    const resolved = String(data?.userId || data?.id || "");
    if (!Number.isInteger(Number(resolved)) || Number(resolved) <= 0) {
      throw new Error("Could not resolve a valid organizer user ID");
    }

    sessionStorage.setItem("userID", resolved);
    sessionStorage.setItem("userId", resolved);
    localStorage.setItem("userID", resolved);
    localStorage.setItem("userId", resolved);
    return resolved;
  };

  const readScopedValue = (key, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    if (currentUserId) {
      const scopedValue = localStorage.getItem(`${key}:${currentUserId}`);
      if (scopedValue !== null) return scopedValue;
      return fallback;
    }
    const legacyValue = localStorage.getItem(key);
    return legacyValue !== null ? legacyValue : fallback;
  };

  const writeScopedValue = (key, value) => {
    if (typeof window === "undefined" || !currentUserId) return;
    const storageKey = `${key}:${currentUserId}`;
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, String(value));
  };

  const resetFromScopedStorage = () => {
    setOrgName(readScopedValue("organizationName", "Organization Name"));
    setDescription(readScopedValue("organizationDescription", "Not set"));
    setContactEmail(readScopedValue("userEmail", "no-reply@organization.org"));
    setCity(readScopedValue("city", "Lahore"));
    setProfilePictureDataUrl(readScopedValue("profilePictureURL", ""));
  };

  useEffect(() => {
    let isMounted = true;
    const userId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId");
    setCurrentUserId(userId || "");

    const readInitial = (key, fallback = "") => {
      const currentId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId");
      if (currentId) {
        const scopedValue = localStorage.getItem(`${key}:${currentId}`);
        if (scopedValue !== null) return scopedValue;
        return fallback;
      }
      const legacyValue = localStorage.getItem(key);
      return legacyValue !== null ? legacyValue : fallback;
    };

    const savedOrg = readInitial("organizationName", "Organization Name");
    const savedDesc = readInitial("organizationDescription", "Not set");
    const savedEmail = readInitial("userEmail", "no-reply@organization.org");
    const savedCity = readInitial("city", "Lahore");
    const savedVer = readInitial("organizationVerificationStatus", "Pending");
    const savedPic = readInitial("profilePictureURL", "");

    if (savedOrg) setOrgName(savedOrg);
    if (savedDesc) setDescription(savedDesc);
    if (savedEmail) setContactEmail(savedEmail);
    if (savedCity) setCity(savedCity);
    if (savedVer) setVerification(savedVer);
    if (savedPic) setProfilePictureDataUrl(savedPic);

    const fetchProfile = async () => {
      try {
        const resolvedUserId = userId || await resolveOrganizerId();
        if (!isMounted || !resolvedUserId) return;
        setCurrentUserId(resolvedUserId);
        setStatus("Loading profile...");
        const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(resolvedUserId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(resolvedUserId),
          },
        });
        const data = await res.json();
        if (!res.ok || !data) {
          throw new Error(data?.message || "Failed to load profile");
        }

        const nextName = data.OrganizationName || savedOrg || "Organization Name";
        const nextDesc = data.Description || savedDesc || "Not set";
        const nextEmail = data.ContactEmail || data.Email || savedEmail || "no-reply@organization.org";
        const nextCity = data.City || savedCity || "Lahore";
        const nextVer = data.VerificationStatus || savedVer || "Pending";
        const nextPic = data.ProfilePictureURL || savedPic || "";

        setOrgName(nextName);
        setDescription(nextDesc);
        setContactEmail(nextEmail);
        setCity(nextCity);
        setVerification(nextVer);
        setProfilePictureDataUrl(nextPic);

        localStorage.setItem(`organizationName:${resolvedUserId}`, nextName);
        localStorage.setItem(`organizationDescription:${resolvedUserId}`, nextDesc);
        localStorage.setItem(`userEmail:${resolvedUserId}`, nextEmail);
        localStorage.setItem(`city:${resolvedUserId}`, nextCity);
        localStorage.setItem(`organizationVerificationStatus:${resolvedUserId}`, nextVer);
        localStorage.setItem(`displayName:${resolvedUserId}`, nextName);
        localStorage.setItem(`profilePictureURL:${resolvedUserId}`, nextPic);

        sessionStorage.setItem("displayName", nextName);
        sessionStorage.setItem("userEmail", nextEmail);
        localStorage.setItem("organizationName", nextName);
        localStorage.setItem("userEmail", nextEmail);
        localStorage.setItem("city", nextCity);
        localStorage.setItem("displayName", nextName);
        localStorage.setItem("profilePictureURL", nextPic);
        setStatus("");
      } catch (err) {
        if (isMounted) {
          setStatus(err.message || "Could not fetch profile from server");
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const loadOrganizerEvents = async () => {
      let organizerId = currentUserId;
      if (!organizerId || !Number.isInteger(Number(organizerId))) {
        try {
          organizerId = await resolveOrganizerId();
          if (organizerId) setCurrentUserId(organizerId);
        } catch (_err) {
          return;
        }
      }
      if (!organizerId || !Number.isInteger(Number(organizerId))) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/events?organizerId=${encodeURIComponent(organizerId)}`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Failed to load events");
        const list = Array.isArray(data) ? data : [];
        setEvents(list);
        if (!selectedEventId && list.length > 0) {
          setSelectedEventId(String(list[0].EventID || list[0].eventId || ""));
        }
      } catch (_err) {
        setEvents([]);
      }
    };

    loadOrganizerEvents();
  }, [currentUserId, selectedEventId]);

  const handleProfilePicture = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result.toString();
      setProfilePictureDataUrl(url);
      writeScopedValue("profilePictureURL", url);
      localStorage.setItem("profilePictureURL", url);
    };
    reader.readAsDataURL(file);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const submitCheckIn = async (overrideCode) => {
    const code = String(overrideCode || qrCodeInput || "").trim();
    if (!code) {
      setScanStatus("Please paste a QR code.");
      return;
    }

    if (!selectedEventId || !Number.isInteger(Number(selectedEventId))) {
      setScanStatus("Please select an event first.");
      return;
    }

    try {
      setIsCheckingIn(true);
      setScanStatus("");
      const userIdMatch = String(code)
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
        .match(/EDUQR\W*(\d+)\W*/i);
      const parsedQrUserId = Number(userIdMatch?.[1]);

      const payload = {
        qrCode: code,
        eventId: String(Number(selectedEventId)),
      };
      if (Number.isInteger(parsedQrUserId) && parsedQrUserId > 0) {
        payload.qrUserId = String(parsedQrUserId);
      }

      const res = await fetch(`${API_BASE_URL}/api/events/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(currentUserId || ""),
        },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_err) {
        data = { message: raw || "Check-in failed" };
      }
      if (!res.ok) throw new Error(data?.message || "Check-in failed");
      setScanStatus(data?.message || "Attendance marked!");
      setQrCodeInput("");
    } catch (err) {
      setScanStatus(err?.message || "Could not mark attendance.");
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell max-w-5xl mx-auto">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6 flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Organization Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Home</Link>
            <Link href="/dashboardO" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Dashboard</Link>
          </div>
        </header>

        <section className="glass reveal-up w-full rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--surface-soft)] flex items-center justify-center text-xl text-slate-600">
                  {profilePictureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePictureDataUrl} alt="Organization" className="h-full w-full object-cover" />
                  ) : (
                    orgName.charAt(0) || "O"
                  )}
                </div>
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={!isEditing}
                  className="absolute -right-1 -bottom-1 bg-white border rounded-full p-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Change profile picture"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8.414A2 2 0 0016.414 7L13 3.586A2 2 0 0011.586 3H4z" />
                  </svg>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleProfilePicture(e.target.files?.[0])} className="hidden" />
              </div>
              <div className="mt-3 text-center text-sm text-slate-600">Profile Picture</div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Organization Name</div>
                <div className="flex-1">
                  <input disabled={!isEditing} value={orgName} onChange={(e) => setOrgName(e.target.value)} className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Description</div>
                <div className="flex-1">
                  <textarea disabled={!isEditing} value={description === "Not set" ? "" : description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500" rows={4} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Contact Email</div>
                <div className="flex-1">
                  <input
                    disabled={!isEditing}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500"
                    type="email"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">City</div>
                <div className="flex-1">
                  <select
                    disabled={!isEditing}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {ALLOWED_CITIES.map((cityOption) => (
                      <option key={cityOption} value={cityOption}>{cityOption}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Verification</div>
                <div className="flex-1">
                  <div className="text-sm text-slate-800">{verification}</div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--stroke)] bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Quick QR Attendance</p>
                  <Link href="/attendanceO" className="text-xs font-semibold text-[var(--brand)] hover:underline">Open Full Attendance Page</Link>
                </div>

                <label className="mb-1 block text-xs text-slate-600">Event</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
                >
                  {events.map((ev) => (
                    <option key={ev.EventID || ev.eventId} value={String(ev.EventID || ev.eventId)}>
                      {ev.Title || ev.title}
                    </option>
                  ))}
                </select>

                <label className="mt-3 mb-1 block text-xs text-slate-600">QR Code</label>
                <input
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCheckIn();
                    }
                  }}
                  placeholder="Paste QR token"
                  className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
                />

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => submitCheckIn()}
                    disabled={isCheckingIn || !qrCodeInput.trim()}
                    className="rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {isCheckingIn ? "Checking in..." : "Mark Attendance"}
                  </button>
                </div>

                {scanStatus && <p className="mt-2 text-sm text-slate-700">{scanStatus}</p>}
              </div>

              <div className="mt-4 flex gap-3">
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="cta px-4 py-2 font-semibold">Edit Profile</button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                    localStorage.setItem("organizationName", orgName);
                    sessionStorage.setItem("displayName", orgName);
                    sessionStorage.setItem("userEmail", contactEmail);
                    localStorage.setItem("userEmail", contactEmail);
                    localStorage.setItem("city", city);
                    localStorage.setItem("displayName", orgName);
                    writeScopedValue("organizationName", orgName);
                    writeScopedValue("organizationDescription", description);
                    writeScopedValue("userEmail", contactEmail);
                    writeScopedValue("city", city);
                    writeScopedValue("organizationVerificationStatus", verification);
                    writeScopedValue("displayName", orgName);
                    writeScopedValue("profilePictureURL", profilePictureDataUrl || "");

                    const userId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId");
                    if (!userId) {
                      alert("Organization profile saved locally. Please login again to sync backend.");
                      return;
                    }

                    try {
                      setStatus("Saving profile...");
                      const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          "x-user-id": String(userId),
                        },
                        body: JSON.stringify({
                          role: "organizer",
                          organizationName: orgName,
                          description: description === "Not set" ? null : description,
                          contactEmail: contactEmail || null,
                          city: city || null,
                          profilePictureURL: profilePictureDataUrl || null,
                        }),
                      });

                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        throw new Error(body.message || "Failed to save profile");
                      }

                      setStatus("Profile saved successfully.");
                      setIsEditing(false);
                    } catch (err) {
                      setStatus(err.message || "Profile save failed");
                    }
                  }}
                  className="cta px-4 py-2 font-semibold"
                >
                  Save Profile
                </button>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFromScopedStorage();
                      setIsEditing(false);
                      setStatus("");
                    }}
                    className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]"
                  >
                    Cancel Edit
                  </button>
                )}
                <Link href="/dashboardO" className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]">Cancel</Link>
              </div>
              {status && <p className="text-sm text-slate-700">{status}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}