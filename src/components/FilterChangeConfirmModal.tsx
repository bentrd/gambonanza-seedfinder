import { useEffect } from "react";
import { createPortal } from "react-dom";

interface FilterChangeConfirmModalProps {
  open: boolean;
  /** Initial value of the "never show again" checkbox. */
  skipNextTime: boolean;
  onSkipNextTimeChange: (next: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation popin shown when the user mutates a filter while there
 * are search results on screen. Applying the change drops every result
 * the user has accumulated so far (the pagination cursor + collected
 * matches are filter-dependent), so we ask before discarding.
 *
 * If the user ticks "never show again" we persist that to localStorage
 * (handled by the parent) — bypassing the modal entirely on future
 * filter changes. Hosted in a portal so it sits above everything else
 * (including the gambit unlocks modal).
 */
export function FilterChangeConfirmModal({
  open,
  skipNextTime,
  onSkipNextTimeChange,
  onConfirm,
  onCancel,
}: FilterChangeConfirmModalProps) {
  // Esc cancels.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  // Body scroll lock.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-change-title"
    >
      <div
        className="absolute inset-0 bg-black/55"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="card-window relative z-10 mt-6 w-full max-w-md">
        <span className="window-title" id="filter-change-title">
          Reset results?
        </span>

        <p className="pt-1 text-sm leading-snug text-[var(--color-wine-dark)]">
          Changing this filter will reset the results table and start a
          fresh search. Anything you've scrolled to so far will be lost.
        </p>

        <label className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/80">
          <input
            type="checkbox"
            checked={skipNextTime}
            onChange={(e) => onSkipNextTimeChange(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--color-wine)]"
          />
          Never show this again
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-cream text-sm uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-wine text-sm uppercase"
          >
            Reset & change
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
