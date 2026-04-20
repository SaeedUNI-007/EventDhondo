'use client';

import React from 'react';

export default function ConfirmModal({ open, title = 'Confirm', message = '', onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-4 bg-[var(--surface)] rounded-lg shadow-lg ring-1 ring-black/5 p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap">{message}</p>

        <div className="flex justify-center gap-4">
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-[var(--danger)] text-white font-semibold shadow-sm"
          >
            Yes
          </button>

          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-white text-slate-800 border border-[var(--stroke)]"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}