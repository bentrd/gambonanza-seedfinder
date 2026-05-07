import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PixelToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  children: ReactNode;
}

const ACTIVE_CLASS =
  "bg-[var(--color-wine)] text-[var(--color-cream)] shadow-[0_2px_0_0_var(--color-wine-deep),0_3px_0_0_var(--color-ink)]";

const IDLE_CLASS =
  "bg-[var(--color-cream-light)] text-[var(--color-wine-dark)] shadow-[0_2px_0_0_var(--color-cream-soft),0_3px_0_0_var(--color-ink)] hover:bg-white";

export function PixelToggle({
  active,
  className = "",
  children,
  type = "button",
  ...rest
}: PixelToggleProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`cursor-pointer rounded-md border-2 border-[var(--color-ink)] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? ACTIVE_CLASS : IDLE_CLASS
      } ${className}`}
    >
      {children}
    </button>
  );
}
