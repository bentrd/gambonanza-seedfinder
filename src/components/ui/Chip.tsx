import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

const CHIP_CLASS =
  "chip-cream cursor-pointer text-[11px] uppercase tracking-wider transition-transform hover:bg-[var(--color-wine)] hover:text-[var(--color-cream)] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40";

interface ChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function ChipButton({
  className = "",
  children,
  type = "button",
  ...rest
}: ChipButtonProps) {
  return (
    <button type={type} {...rest} className={`${CHIP_CLASS} ${className}`}>
      {children}
    </button>
  );
}

interface ChipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

export function ChipLink({ className = "", children, ...rest }: ChipLinkProps) {
  return (
    <a {...rest} className={`${CHIP_CLASS} inline-flex items-center ${className}`}>
      {children}
    </a>
  );
}
