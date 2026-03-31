"use client";
import { useState } from "react";
import { X, Loader } from "lucide-react";

export default function CreateTeamModal({ isOpen, onClose, eventId, userId, onTeamCreated }) {
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }

    if (teamName.length > 50) {
      setError("Team name must be 50 characters or less");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({
          eventId: Number(eventId),
          teamName: teamName.trim(),
          leaderId: Number(userId),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to create team");
      }

      setTeamName("");
      onTeamCreated(data.teamId);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create team");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="glass mx-4 w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Form a Team</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          You will be the Team Leader. You can invite members after creation.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Team Name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => {
              setTeamName(e.target.value.slice(0, 50));
              setError("");
            }}
            placeholder="Enter team name"
            maxLength={50}
            disabled={isLoading}
            className="w-full rounded-lg border border-[var(--stroke)] bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-500">
            {teamName.length}/50
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 p-3">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-white/50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateTeam}
            disabled={isLoading || !teamName.trim()}
            className="flex-1 rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-4 py-2 text-white font-semibold text-sm hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Team"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
