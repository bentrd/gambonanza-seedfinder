import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Gambit } from "../rng";
import { gambitDisplayName } from "../rng";
import { TIER_BG } from "../rng/rarityColors";

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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
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
              <span
                className={`inline-block rounded-md border-2 border-[var(--color-ink)] px-1.5 py-0 font-display text-[9px] uppercase tracking-wider text-[var(--color-ink)] ${TIER_BG[gambit.rarity]}`}
              >
                {gambit.rarity.toLowerCase()}
              </span>
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
 * Minimal renderer for the Unity rich-text tags that appear in gambit
 * descriptions:
 *
 *   <br>                 → newline (rendered via whitespace-pre-line)
 *   <color=X>…</color>   → highlighted span
 *   <sprite=N>           → small bracketed "icon" placeholder
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
    } else if (tag.kind === "color-open") {
      const close = src.indexOf("</color>", tag.end);
      if (close === -1) {
        out.push(src.slice(tag.end));
        break;
      }
      const inner = src.slice(tag.end, close);
      out.push(
        <span key={`c${key++}`} className="font-bold text-[var(--color-wine)]">
          {renderUnityRichText(inner)}
        </span>,
      );
      i = close + "</color>".length;
    } else {
      out.push(
        <span
          key={`s${key++}`}
          className="mx-0.5 inline-block rounded-sm bg-[var(--color-cream-soft)] px-1 text-[9px] uppercase tracking-wider text-[var(--color-wine-dark)]/60"
        >
          icon
        </span>,
      );
      i = tag.end;
    }
  }
  return out;
}

type Tag =
  | { kind: "br"; start: number; end: number }
  | { kind: "color-open"; start: number; end: number }
  | { kind: "sprite"; start: number; end: number };

function nextTag(src: string, from: number): Tag | null {
  const re = /<(br\s*\/?|color=[^>]*|sprite=[^>]*)>/gi;
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m) return null;
  const body = m[1].toLowerCase();
  if (body.startsWith("br")) {
    return { kind: "br", start: m.index, end: m.index + m[0].length };
  }
  if (body.startsWith("color=")) {
    return { kind: "color-open", start: m.index, end: m.index + m[0].length };
  }
  return { kind: "sprite", start: m.index, end: m.index + m[0].length };
}
