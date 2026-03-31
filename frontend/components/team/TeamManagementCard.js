"use client";
import { useState, useEffect } from "react";
import { Users, Mail, Plus, Loader, AlertCircle } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function TeamManagementCard({ teamId, teamName, leaderId, userId, eventId, leaderName = "Team Leader" }) {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isLeader = Number(userId) === Number(leaderId);

  // Fetch team members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await fetch(
          `${API_BASE_URL}/api/teams/${teamId}/members`,
          {
            headers: { "x-user-id": String(userId) },
          }
        );

        const data = await response.json();

        if (response.ok && Array.isArray(data)) {
          setMembers(data);
        } else {
          // Fallback with leader's actual name if available
          const displayName = isLeader ? "You" : leaderName;
          setMembers([
            { id: leaderId, name: displayName, email: null, status: "Joined", isLeader: true },
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch team members:", err);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    if (teamId) {
      fetchMembers();
    }
  }, [teamId, userId, leaderId, leaderName, isLeader]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    setError("");
    setMessage("");

    try {
      // First, fetch user by email to get their ID
      const userRes = await fetch(
        `${API_BASE_URL}/api/users?email=${encodeURIComponent(inviteEmail.trim())}`,
        {
          headers: { "x-user-id": String(userId) },
        }
      );

      console.log("User lookup response status:", userRes.status);
      const userData = await userRes.json().catch(err => {
        console.error("Failed to parse user response:", err);
        return null;
      });

      console.log("User lookup response data:", userData);

      if (!userRes.ok) {
        throw new Error(userData?.message || "User not found with that email. Please check the email address.");
      }

      const invitedUserId = userData?.id || userData?.userId;

      if (!invitedUserId) {
        setError("User email found but no user ID returned. Please try again.");
        setIsInviting(false);
        return;
      }

      // Check if already a member
      if (Number(invitedUserId) === Number(userId)) {
        setError("You cannot invite yourself");
        setIsInviting(false);
        return;
      }

      // Send invite
      const response = await fetch(`${API_BASE_URL}/api/teams/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({
          teamId: Number(teamId),
          invitedUserId: Number(invitedUserId),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to send invite");
      }

      setMessage("Invitation sent successfully!");
      setInviteEmail("");

      // Add to members list with pending status
      setMembers([
        ...members,
        { id: invitedUserId, email: inviteEmail, name: userData?.name || inviteEmail.split('@')[0], status: "Pending", isLeader: false },
      ]);
    } catch (err) {
      console.error("Invite error:", err);
      setError(err?.message || "Failed to send invitation. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold";

    switch (status?.toLowerCase()) {
      case "joined":
        return (
          <span className={`${baseClasses} bg-[var(--brand)]/10 text-[var(--brand)]`}>
            ✅ Joined
          </span>
        );
      case "pending":
        return (
          <span className={`${baseClasses} bg-[var(--accent)]/10 text-[#d9860f]`}>
            ⏳ Pending
          </span>
        );
      case "declined":
        return (
          <span className={`${baseClasses} bg-[var(--danger)]/10 text-[var(--danger)]`}>
            ❌ Declined
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-slate-100 text-slate-600`}>
            • {status}
          </span>
        );
    }
  };

  return (
    <div className="glass rounded-2xl p-6 mt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-[var(--stroke)]">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{teamName}</h3>
              {isLeader && (
                <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-[var(--brand)]/10 text-[var(--brand)]">
                  Leader
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Team Members</h4>

        {isLoadingMembers ? (
          <div className="flex items-center justify-center py-4">
            <Loader className="h-5 w-5 animate-spin text-[var(--brand)]" />
          </div>
        ) : members.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-500">No members yet. Start inviting!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id || Math.random()}
                className="flex items-center justify-between p-3 rounded-lg bg-white/40 border border-white/60"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {member.name || member.email || "Unknown"}
                    {member.isLeader && (
                      <span className="ml-2 text-xs font-semibold text-[var(--brand)]">
                        {isLeader ? "(You)" : "(Leader)"}
                      </span>
                    )}
                  </p>
                  {member.email && (
                    <p className="text-xs text-slate-600">{member.email}</p>
                  )}
                </div>
                <div className="ml-3">{getStatusBadge(member.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Section */}
      {isLeader && (
        <div className="rounded-lg bg-[var(--brand)]/5 border border-[var(--brand)]/20 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-3">Invite Team Member</p>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setError("");
                }}
                placeholder="teammate@email.com"
                disabled={isInviting}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--brand)]/30 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleInvite}
              disabled={isInviting || !inviteEmail.trim()}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] text-white font-semibold text-sm hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isInviting ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

          {error && (
            <div className="mt-2 flex items-start gap-2 text-sm text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {message && (
            <div className="mt-2 text-sm text-[var(--brand)]">
              ✓ {message}
            </div>
          )}
        </div>
      )}

      {!isLeader && (
        <div className="rounded-lg bg-slate-100/50 border border-slate-200 p-4">
          <p className="text-sm text-slate-600">
            Only the team leader can invite new members.
          </p>
        </div>
      )}
    </div>
  );
}
