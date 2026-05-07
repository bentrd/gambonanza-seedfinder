import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: "sm" | "md";
}

const SIZE_CLASS: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "size-7 text-sm",
  md: "h-8 px-3 text-[11px] uppercase tracking-wider",
};

export function IconButton({
  size = "sm",
  className = "",
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`flex cursor-pointer items-center justify-center rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream)] text-[var(--color-wine-dark)] shadow-[0_2px_0_0_var(--color-cream-soft)] transition-transform hover:bg-[var(--color-wine)] hover:text-[var(--color-cream)] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${SIZE_CLASS[size]} ${className}`}
    >
      {children}
    </button>
  );
}
