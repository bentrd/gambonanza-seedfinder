import type { ReactNode } from "react";

interface InfoTooltipProps {
  children: ReactNode;
  className?: string;
}

export function InfoTooltip({ children, className = "" }: InfoTooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span
        tabIndex={0}
        aria-label="info"
        className="flex size-4 cursor-help items-center justify-center rounded-full border border-[var(--color-wine-dark)]/35 font-display text-[9px] leading-none text-[var(--color-wine-dark)]/55 transition-colors group-hover:border-[var(--color-wine)] group-hover:text-[var(--color-wine)]"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 py-2 text-[11px] leading-snug text-[var(--color-wine-dark)] opacity-0 shadow-[0_3px_0_0_var(--color-ink)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
