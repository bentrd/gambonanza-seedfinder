import type { Rarity } from "./types";

export type Tier = Rarity | "ANY";

/** Background-color class only — pair with an explicit text color where used. */
export const TIER_BG: Record<Tier, string> = {
  ANY: "bg-[var(--color-cream-light)]",
  COMMON: "bg-[var(--color-common)]",
  RARE: "bg-[var(--color-rare)]",
  EPIC: "bg-[var(--color-epic)]",
  LEGENDARY: "bg-[var(--color-legendary)]",
};

/** Default text color paired with each tier bg (chosen for legible contrast). */
export const TIER_TEXT: Record<Tier, string> = {
  ANY: "text-[var(--color-wine-dark)]",
  COMMON: "text-[var(--color-ink)]",
  RARE: "text-[var(--color-ink)]",
  EPIC: "text-[var(--color-ink)]",
  LEGENDARY: "text-[var(--color-ink)]",
};

/** Inclusive [min, max] roll bounds for each tier — single source of truth. */
export const TIER_BANDS: Record<Tier, readonly [number, number]> = {
  ANY: [0, 100],
  COMMON: [0, 39],
  RARE: [40, 69],
  EPIC: [70, 89],
  LEGENDARY: [90, 100],
};
