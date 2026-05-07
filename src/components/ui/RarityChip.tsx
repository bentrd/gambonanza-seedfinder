import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Tier } from "../../rng/rarityColors";
import { TIER_BG, TIER_TEXT } from "../../rng/rarityColors";

interface RarityChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tier: Tier;
  active: boolean;
  children: ReactNode;
}

export function RarityChip({
  tier,
  active,
  className = "",
  children,
  type = "button",
  ...rest
}: RarityChipProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`cursor-pointer rounded-md border-2 border-[var(--color-ink)] px-2 py-1 font-display text-[11px] uppercase tracking-wider transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${TIER_BG[tier]} ${TIER_TEXT[tier]} ${
        active
          ? "shadow-[0_2px_0_0_var(--color-ink)]"
          : "opacity-55 saturate-75 hover:opacity-90 hover:saturate-100"
      } ${className}`}
    >
      {children}
    </button>
  );
}
