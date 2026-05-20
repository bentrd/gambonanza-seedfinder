import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Gambit } from "../rng";
import { gambitDisplayName } from "../rng";
import { RarityBadge } from "./ui/RarityBadge";

interface GambitTooltipProps {
  gambit: Gambit;
  children: ReactNode;
}

const TOOLTIP_W = 240;
const TOOLTIP_OFFSET = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Wraps a trigger element (a gambit toggle / chip) and shows a rich
 * tooltip with the localized name + description on hover or focus.
 *
 * The tooltip is rendered into a portal at `document.body` so it can
 * escape any `overflow:auto` ancestor (the gambit picker scrolls), and
 * its final position is clamped to the viewport after measuring its
 * real bounding rect — so it's always fully visible regardless of where
 * the trigger sits.
 */
export function GambitTooltip({ gambit, children }: GambitTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /** Tracks whether the current open-state was triggered by a touch.
   *  Mouse hover-out should close, but a touch-open should stay until
   *  the user explicitly taps outside. */
  const stickyTouchRef = useRef(false);

  const handlePointerEnter = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch") return;
    setOpen(true);
  };
  const handlePointerLeave = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch") return;
    if (stickyTouchRef.current) return;
    setOpen(false);
  };
  const handlePointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== "touch") return;
    // Don't preventDefault — the underlying button (gambit toggle) still
    // needs its click to fire. We're only toggling the tooltip.
    setOpen((prev) => {
      stickyTouchRef.current = !prev;
      return !prev;
    });
  };

  // Outside-tap dismissal while sticky.
  useEffect(() => {
    if (!open || !stickyTouchRef.current) return;
    const onDown = (e: PointerEvent) => {
      const t = triggerRef.current;
      const p = tooltipRef.current;
      const target = e.target as Node | null;
      if (target && t?.contains(target)) return;
      if (target && p?.contains(target)) return;
      setOpen(false);
      stickyTouchRef.current = false;
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;

    const tr = trigger.getBoundingClientRect();
    const th = tip.offsetHeight;
    const tw = tip.offsetWidth || TOOLTIP_W;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: center on trigger, clamp to viewport.
    let left = tr.left + tr.width / 2 - tw / 2;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(vw - tw - VIEWPORT_MARGIN, left),
    );

    // Vertical: prefer above; if it would clip the top edge, place below.
    let top = tr.top - TOOLTIP_OFFSET - th;
    if (top < VIEWPORT_MARGIN) {
      // Try below.
      const below = tr.bottom + TOOLTIP_OFFSET;
      if (below + th <= vh - VIEWPORT_MARGIN) {
        top = below;
      } else {
        // Neither fully fits — pin to whichever side has more room.
        const spaceAbove = tr.top;
        const spaceBelow = vh - tr.bottom;
        top =
          spaceAbove >= spaceBelow
            ? Math.max(VIEWPORT_MARGIN, tr.top - TOOLTIP_OFFSET - th)
            : Math.min(vh - th - VIEWPORT_MARGIN, tr.bottom + TOOLTIP_OFFSET);
      }
    }

    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  const name = gambitDisplayName(gambit);

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => {
        if (!stickyTouchRef.current) setOpen(false);
      }}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: "fixed",
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              width: TOOLTIP_W,
              maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
              opacity: pos ? 1 : 0,
            }}
            className="pointer-events-none z-50 overflow-y-auto rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 py-2 text-left text-[11px] leading-snug text-[var(--color-wine-dark)] shadow-[0_3px_0_0_var(--color-ink)]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-display text-[12px] uppercase tracking-wider text-[var(--color-wine)]">
                {name}
              </span>
              <RarityBadge rarity={gambit.rarity} size="xs" />
            </div>
            <div className="whitespace-pre-line text-[var(--color-wine-dark)]/95">
              {renderUnityRichText(gambit.description)}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

/**
 * Renderer for the Unity / TextMeshPro rich-text tags that appear in
 * gambit descriptions. Handles the union actually observed across all
 * 200 gambits:
 *
 *   <br>                  → newline (rendered via whitespace-pre-line)
 *   <sprite=N>            → small "icon" placeholder
 *   <color=X>…</color>    → bolded wine span (X is a palette glyph)
 *   <rainb l=…>…</rainb>  → rainbow gradient text (PROMOTE callouts)
 *   <wave>…</wave>        → emphasised callout (TMP would animate it)
 *   <shake>…</shake>      → emphasised callout
 *   <i>…</i>              → italic
 *
 * Anything else falls through as literal text.
 */
function renderUnityRichText(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < src.length) {
    const tag = nextTag(src, i);
    if (!tag) {
      out.push(src.slice(i));
      break;
    }
    if (tag.start > i) out.push(src.slice(i, tag.start));

    if (tag.kind === "br") {
      out.push("\n");
      i = tag.end;
    } else if (tag.kind === "sprite") {
      // <sprite=N> — render the matching TMP atlas icon (extracted to
      // public/game/tmp-icons/<N>.png by extract_gambits.py).
      const idxMatch = src.slice(tag.start, tag.end).match(/sprite=(\d+)/i);
      const idx = idxMatch ? parseInt(idxMatch[1], 10) : -1;
      out.push(<SpriteIcon key={`s${key++}`} idx={idx} />);
      i = tag.end;
    } else {
      // paired tag — find matching `</name>` and recurse on the inner.
      const closeTag = `</${tag.name}>`;
      const close = src.toLowerCase().indexOf(closeTag, tag.end);
      if (close === -1) {
        out.push(src.slice(tag.end));
        break;
      }
      const inner = src.slice(tag.end, close);
      out.push(
        <PairedSpan key={`p${key++}`} name={tag.name}>
          {renderUnityRichText(inner)}
        </PairedSpan>,
      );
      i = close + closeTag.length;
    }
  }
  return out;
}

const PAIRED_TAGS = new Set(["color", "rainb", "wave", "shake", "i"]);

type Tag =
  | { kind: "br"; start: number; end: number }
  | { kind: "sprite"; start: number; end: number }
  | { kind: "paired"; name: string; start: number; end: number };

function nextTag(src: string, from: number): Tag | null {
  // Matches any tag: <name>, <name=…>, <name attr=…>, <name/>. We tolerate
  // `=` directly after the name (e.g. <color=ß>, <sprite=7>) and arbitrary
  // attribute soup up to the closing `>`.
  const re = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  re.lastIndex = from;
  while (true) {
    const m = re.exec(src);
    if (!m) return null;
    const name = m[1].toLowerCase();
    const start = m.index;
    const end = m.index + m[0].length;
    if (name === "br") return { kind: "br", start, end };
    if (name === "sprite") return { kind: "sprite", start, end };
    if (PAIRED_TAGS.has(name)) return { kind: "paired", name, start, end };
    // Unknown tag — skip silently and keep scanning so we don't render the
    // literal text. Closing tags (e.g. </color>) fall here too; the matching
    // paired branch above eats them via indexOf on the close-tag string.
    re.lastIndex = end;
  }
}

function PairedSpan({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  switch (name) {
    case "color":
      return (
        <span className="font-bold text-[var(--color-wine)]">{children}</span>
      );
    case "rainb":
      return <RainbowBop>{children}</RainbowBop>;
    case "wave":
    case "shake":
      return (
        <span className="font-bold text-[var(--color-wine-light)]">
          {children}
        </span>
      );
    case "i":
      return <em>{children}</em>;
    default:
      return <>{children}</>;
  }
}

// Roughly evenly-spaced ROYGBIV hues. Hand-tuned so each char in a short
// word (e.g. "PROMOTION", 9 chars) gets visibly different colors without
// looking electric.
const RAINBOW_HUES = [
  "#e53935", // red
  "#f4801f", // orange
  "#f4c530", // yellow
  "#7fb857", // green
  "#3aa0bf", // teal
  "#5e6cd6", // indigo
  "#a35bd6", // violet
];

/**
 * Renders Unity `<rainb>` content as a per-character animation: rainbow
 * fill + a staggered vertical "hola" bop wave. Children are expected to
 * be plain strings (true for every gambit in our data); any non-string
 * node renders inline unchanged at the same point in the sequence.
 */
function RainbowBop({ children }: { children: ReactNode }) {
  // Flatten children to a sequence of (str | ReactNode) and count chars
  // so the bop wave stays continuous across the whole content.
  const nodes: ReactNode[] = [];
  let charIdx = 0;
  const items = Array.isArray(children) ? children : [children];
  for (const item of items) {
    if (typeof item === "string" || typeof item === "number") {
      const s = String(item);
      for (let k = 0; k < s.length; k++) {
        const ch = s[k];
        if (ch === " " || ch === " ") {
          // Spaces don't need spans, but still advance the wave so the
          // crest visually "passes over" them.
          nodes.push(ch);
          charIdx++;
          continue;
        }
        nodes.push(
          <span
            key={`rb${charIdx}`}
            className="rainb-char"
            style={{
              color: RAINBOW_HUES[charIdx % RAINBOW_HUES.length],
              animationDelay: `${charIdx * 60}ms`,
            }}
          >
            {ch}
          </span>,
        );
        charIdx++;
      }
    } else {
      nodes.push(item);
    }
  }
  return <span className="inline">{nodes}</span>;
}

// Native pixel dimensions of each TMP atlas sprite (from the extracted
// PNGs). Used to compute the inline icon's width while pinning its
// height — same approach as PieceIcon — so nothing renders stretched.
const TMP_SPRITE_DIMS: Record<number, { w: number; h: number }> = {
  0:  { w: 250, h: 273 },  // BLESS tile
  1:  { w: 250, h: 273 },  // GOLDEN tile
  2:  { w: 250, h: 273 },  // PROTECTIVE tile
  3:  { w: 250, h: 273 },  // TRAP tile
  4:  { w: 209, h: 253 },  // unused (Mouse)
  5:  { w: 185, h: 206 },  // PAWN
  6:  { w: 185, h: 228 },  // ROOK
  7:  { w: 207, h: 239 },  // KNIGHT
  8:  { w: 184, h: 282 },  // BISHOP
  9:  { w: 206, h: 218 },  // KING
  10: { w: 249, h: 228 },  // QUEEN
  11: { w: 143, h: 284 },  // THREATEN ('!')
  12: { w: 251, h: 273 },  // PHANTOM
  13: { w: 249, h: 272 },  // unused
};

const TMP_ICON_HEIGHT = 18; // px

function SpriteIcon({ idx }: { idx: number }) {
  const dim = TMP_SPRITE_DIMS[idx];
  if (!dim) {
    return (
      <span className="mx-0.5 inline-block rounded-sm bg-[var(--color-cream-soft)] px-1 text-[9px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
        ?{idx}
      </span>
    );
  }
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const h = TMP_ICON_HEIGHT;
  const w = Math.round((dim.w / dim.h) * h);
  return (
    <img
      src={`${base}/game/tmp-icons/${idx}.png`}
      alt=""
      width={w}
      height={h}
      className="pixel mx-0.5 inline-block align-text-bottom"
      draggable={false}
    />
  );
}
