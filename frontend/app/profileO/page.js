"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ProfileO() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [orgName, setOrgName] = useState("Organization Name");
  const [description, setDescription] = useState("Not set");
  const [contactEmail, setContactEmail] = useState("no-reply@organization.org");
  const [verification, setVerification] = useState("Pending");
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef(null);

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
    setProfilePictureDataUrl(readScopedValue("profilePictureURL", ""));
  };

  useEffect(() => {
    const userId = localStorage.getItem("userID") || localStorage.getItem("userId");
    setCurrentUserId(userId || "");

    const readInitial = (key, fallback = "") => {
      if (userId) {
        const scopedValue = localStorage.getItem(`${key}:${userId}`);
        if (scopedValue !== null) return scopedValue;
        return fallback;
      }
      const legacyValue = localStorage.getItem(key);
      return legacyValue !== null ? legacyValue : fallback;
    };

    const savedOrg = readInitial("organizationName", "Organization Name");
    const savedDesc = readInitial("organizationDescription", "Not set");
    const savedEmail = readInitial("userEmail", "no-reply@organization.org");
    const savedVer = readInitial("organizationVerificationStatus", "Pending");
    const savedPic = readInitial("profilePictureURL", "");

    if (savedOrg) setOrgName(savedOrg);
    if (savedDesc) setDescription(savedDesc);
    if (savedEmail) setContactEmail(savedEmail);
    if (savedVer) setVerification(savedVer);
    if (savedPic) setProfilePictureDataUrl(savedPic);

    const fetchProfile = async () => {
      if (!userId) return;
      try {
        setStatus("Loading profile...");
        const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!res.ok || !data) {
          throw new Error(data?.message || "Failed to load profile");
        }

        const nextName = data.OrganizationName || savedOrg || "Organization Name";
        const nextDesc = data.Description || savedDesc || "Not set";
        const nextEmail = data.ContactEmail || data.Email || savedEmail || "no-reply@organization.org";
        const nextVer = data.VerificationStatus || savedVer || "Pending";
        const nextPic = data.ProfilePictureURL || savedPic || "";

        setOrgName(nextName);
        setDescription(nextDesc);
        setContactEmail(nextEmail);
        setVerification(nextVer);
        setProfilePictureDataUrl(nextPic);

        localStorage.setItem(`organizationName:${userId}`, nextName);
        localStorage.setItem(`organizationDescription:${userId}`, nextDesc);
        localStorage.setItem(`userEmail:${userId}`, nextEmail);
        localStorage.setItem(`organizationVerificationStatus:${userId}`, nextVer);
        localStorage.setItem(`displayName:${userId}`, nextName);
        localStorage.setItem(`profilePictureURL:${userId}`, nextPic);

        localStorage.setItem("organizationName", nextName);
        localStorage.setItem("userEmail", nextEmail);
        localStorage.setItem("displayName", nextName);
        localStorage.setItem("profilePictureURL", nextPic);
        setStatus("");
      } catch (err) {
        setStatus(err.message || "Could not fetch profile from server");
      }
    };

    fetchProfile();
  }, []);

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
                  <div className="text-sm text-slate-800">{contactEmail}</div>
                  <div className="text-xs text-slate-400 mt-1">Contact email is permanent</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Verification</div>
                <div className="flex-1">
                  <div className="text-sm text-slate-800">{verification}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="cta px-4 py-2 font-semibold">Edit Profile</button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                    localStorage.setItem("organizationName", orgName);
                    localStorage.setItem("userEmail", contactEmail);
                    localStorage.setItem("displayName", orgName);
                    writeScopedValue("organizationName", orgName);
                    writeScopedValue("organizationDescription", description);
                    writeScopedValue("userEmail", contactEmail);
                    writeScopedValue("organizationVerificationStatus", verification);
                    writeScopedValue("displayName", orgName);
                    writeScopedValue("profilePictureURL", profilePictureDataUrl || "");

                    const userId = localStorage.getItem("userID") || localStorage.getItem("userId");
                    if (!userId) {
                      alert("Organization profile saved locally. Please login again to sync backend.");
                      return;
                    }

                    try {
                      setStatus("Saving profile...");
                      const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          role: "organizer",
                          organizationName: orgName,
                          description: description === "Not set" ? null : description,
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