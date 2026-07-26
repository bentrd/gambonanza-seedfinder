import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Tier } from "../../rng/rarityColors";
import { TIER_BG, TIER_TEXT } from "../../rng/rarityColors";

type Size = "xs" | "sm" | "md" | "cell" | "track";
type Variant = "chip" | "inline";
type Font = "display" | "mono";

interface RarityBadgeProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /** Rarity tier - drives the background colour. Pass `"ANY"` for a neutral chip. */
  rarity: Tier;
  /** Visual scale.
   *  - `xs` 9px (tooltip header)
   *  - `sm` 10px (default - section labels, in-text tags)
   *  - `md` 11px (row chips with compound content)
   *  - `cell` fixed 28×36 grid cell used by the help-card MiniGrid
   *  - `track` fixed 20×36 chip used by trajectory rows - every chip
   *    has the same footprint regardless of digit count so the row
   *    stays a clean grid. */
  size?: Size;
  /** Border style. `chip` = chunky 2px ink (default), `inline` = light wine border for in-text usage. */
  variant?: Variant;
  /** `display` = uppercase + tracked (default), `mono` = monospace label for compound content like `LEG 91`. */
  font?: Font;
  /** Forces button mode - also implicit when `onClick` is passed. Selected styling. */
  active?: boolean;
  /** Cell-mode highlight outline (chunky border + drop shadow). */
  highlight?: boolean;
  /** Greyed out - used for "skipped" cells in scenario grids. */
  ghost?: boolean;
  children?: ReactNode;
  className?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  xs:    "px-1.5 py-0.5 text-[9px]",
  sm:    "px-2 py-0.5 text-[10px]",
  md:    "px-2 py-1 text-[11px]",
  cell:  "h-7 w-9 text-[10px]",
  track: "h-5 w-9 px-0 text-[10px] tabular-nums",
};

const VARIANT_CLASSES: Record<Variant, string> = {
  chip:   "border-2 border-[var(--color-ink)] rounded-md",
  inline: "border border-[var(--color-wine-dark)]/20 rounded-sm",
};

const FONT_CLASSES: Record<Font, string> = {
  display: "font-display uppercase tracking-wider",
  mono:    "font-mono",
};

/**
 * Unified rarity badge - every "colored tier label" in the app routes
 * through this component so size/border/font/state changes happen in
 * one place. Three behaviours:
 *
 *  - **Static label** (default): `<span>` with rarity tint, used by the
 *    tooltip header, picker section labels, help-card tag list, etc.
 *  - **Interactive chip** (pass `onClick` or `active`): `<button>` with
 *    hover/active/disabled affordances - used by the gachapon-grid tier
 *    selector.
 *  - **Grid cell** (pass `size="cell"`): fixed-size colored square used
 *    by the help-card walk-through scenarios. Supports `highlight` and
 *    `ghost` modifiers.
 *
 * The colour palette comes from `TIER_BG` / `TIER_TEXT` - both this
 * file and the rest of the app share that single source of truth, so
 * adding a new rarity is one map entry, not six call sites.
 */
export function RarityBadge({
  rarity,
  size = "sm",
  variant = "chip",
  font = "display",
  active,
  highlight,
  ghost,
  children,
  className = "",
  onClick,
  type,
  ...rest
}: RarityBadgeProps) {
  const interactive = onClick !== undefined || active !== undefined;
  const isCell = size === "cell";

  const base = `inline-flex items-center justify-center leading-none ${TIER_BG[rarity]} ${TIER_TEXT[rarity]}`;
  const layout = `${SIZE_CLASSES[size]} ${isCell ? "" : FONT_CLASSES[font]}`;
  const border = isCell
    ? highlight
      ? "border-2 border-[var(--color-ink)] rounded-sm shadow-[0_2px_0_0_var(--color-ink)]"
      : "border border-[var(--color-wine-dark)]/15 rounded-sm"
    : VARIANT_CLASSES[variant];

  const interactiveExtras = interactive
    ? `cursor-pointer transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "shadow-[0_2px_0_0_var(--color-ink)]"
          : "opacity-55 saturate-75 hover:opacity-90 hover:saturate-100"
      }`
    : "";

  const ghostExtras = ghost ? "opacity-30" : "";

  const merged = `${base} ${layout} ${border} ${interactiveExtras} ${ghostExtras} ${className}`;

  const content = children ?? (isCell ? null : rarity.toLowerCase());

  if (interactive) {
    return (
      <button
        type={type ?? "button"}
        onClick={onClick}
        {...rest}
        className={merged}
      >
        {content}
      </button>
    );
  }
  return <span className={merged}>{content}</span>;
}
