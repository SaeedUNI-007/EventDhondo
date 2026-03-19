"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
////////////////////
export default function ProfileO() {
  const [orgName, setOrgName] = useState("Organization Name");
  const [description, setDescription] = useState("Not set");
  const [contactEmail, setContactEmail] = useState("no-reply@organization.org");
  const [verification, setVerification] = useState("Pending");
  const [editing, setEditing] = useState({ orgName: false, description: false });

  useEffect(() => {
    const savedOrg = localStorage.getItem("organizationName");
    const savedDesc = localStorage.getItem("organizationDescription");
    const savedEmail = localStorage.getItem("userEmail");
    const savedVer = localStorage.getItem("organizationVerificationStatus");

    if (savedOrg) setOrgName(savedOrg);
    if (savedDesc) setDescription(savedDesc);
    if (savedEmail) setContactEmail(savedEmail);
    if (savedVer) setVerification(savedVer);
  }, []);

  const startEdit = (k) => setEditing((p) => ({ ...p, [k]: true }));
  const cancelEdit = (k) => {
    const saved = {
      orgName: localStorage.getItem("organizationName") || "Organization Name",
      description: localStorage.getItem("organizationDescription") || "Not set",
    };
    if (k === "orgName") setOrgName(saved.orgName);
    if (k === "description") setDescription(saved.description);
    setEditing((p) => ({ ...p, [k]: false }));
  };
  const saveField = (k) => {
    if (k === "orgName") localStorage.setItem("organizationName", orgName);
    if (k === "description") localStorage.setItem("organizationDescription", description);
    setEditing((p) => ({ ...p, [k]: false }));
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell max-w-5xl mx-auto">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6 flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Organization Profile</h1>
          </div>
          <Link href="/dashboardO" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Dashboard</Link>
        </header>

        <section className="glass reveal-up w-full rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--surface-soft)] flex items-center justify-center text-xl text-slate-600">
                {orgName.charAt(0) || "O"}
              </div>
              <div className="mt-3 text-center text-sm text-slate-600">Profile Picture (add later)</div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Organization Name</div>
                <div className="flex-1 flex items-center justify-between">
                  {editing.orgName ? (
                    <div className="flex items-center gap-2">
                      <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="rounded-xl border border-[var(--stroke)] px-3 py-2" />
                      <button onClick={() => saveField("orgName")} className="rounded px-2 py-1 bg-emerald-600 text-white text-sm">✓</button>
                      <button onClick={() => cancelEdit("orgName")} className="rounded px-2 py-1 bg-white border text-sm">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="text-sm text-slate-800">{orgName}</div>
                      <button onClick={() => startEdit("orgName")} className="ml-3 inline-flex items-center p-1 rounded hover:bg-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Description</div>
                <div className="flex-1">
                  {editing.description ? (
                    <div className="flex items-start gap-2">
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full" rows={4} />
                      <div className="flex flex-col gap-2">
                        <button onClick={() => saveField("description")} className="rounded px-2 py-1 bg-emerald-600 text-white text-sm">✓</button>
                        <button onClick={() => cancelEdit("description")} className="rounded px-2 py-1 bg-white border text-sm">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-800">{description === "Not set" ? <span className="text-slate-400">Not set</span> : description}</div>
                      <button onClick={() => startEdit("description")} className="ml-3 inline-flex items-center p-1 rounded hover:bg-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/></svg>
                      </button>
                    </div>
                  )}
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
                <button onClick={() => { localStorage.setItem("organizationName", orgName); localStorage.setItem("organizationDescription", description); alert("Organization profile saved locally."); }} className="cta px-4 py-2 font-semibold">Save Profile</button>
                <Link href="/dashboardO" className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]">Cancel</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}