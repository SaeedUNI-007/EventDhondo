"use client";
import { useState } from "react";
import { Users, Check, X, Loader } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function TeamInviteAction({
  teamId,
  teamName,
  eventId,
  userId,
  onInviteResponded,
}) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [responded, setResponded] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    setIsAccepting(true);
    setError("");

    try {
      // Call accept endpoint if available, otherwise mark as accepted
      const response = await fetch(
        `${API_BASE_URL}/api/teams/${teamId}/members/${userId}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || "Failed to accept invite");
      }

      setResponded(true);
      onInviteResponded?.("accepted");
    } catch (err) {
      setError(err?.message || "Failed to accept invite");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    setError("");

    try {
      // Call decline endpoint if available, otherwise mark as declined
      const response = await fetch(
        `${API_BASE_URL}/api/teams/${teamId}/members/${userId}/decline`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || "Failed to decline invite");
      }

      setResponded(true);
      onInviteResponded?.("declined");
    } catch (err) {
      setError(err?.message || "Failed to decline invite");
    } finally {
      setIsDeclining(false);
    }
  };

  if (responded) {
    return null;
  }

  return (
    <div className="glass rounded-2xl p-6 mt-4 border-l-4 border-[var(--brand)]">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] flex items-center justify-center flex-shrink-0">
          <Users className="h-6 w-6 text-white" />
        </div>

        <div className="flex-1">
          <h4 className="text-lg font-bold text-slate-900 mb-1">
            🎉 Team Invitation
          </h4>
          <p className="text-sm text-slate-700 mb-4">
            You've been invited to join team{" "}
            <span className="font-semibold">"{teamName}"</span>. Do you want to accept?
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 p-3">
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] text-white font-semibold text-sm hover:shadow-lg disabled:opacity-50"
            >
              {isAccepting ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isAccepting ? "Accepting..." : "Accept"}
            </button>

            <button
              onClick={handleDecline}
              disabled={isAccepting || isDeclining}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[var(--stroke)] bg-white/60 text-slate-700 font-semibold text-sm hover:bg-white/80 disabled:opacity-50"
            >
              {isDeclining ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {isDeclining ? "Declining..." : "Decline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
