import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface CellTooltipProps {
  /** Tooltip body — already styled however you want. */
  content: ReactNode;
  children: ReactNode;
  /** Approx width hint for clamping math. Defaults to 200. */
  width?: number;
}

const VIEWPORT_MARGIN = 8;
const OFFSET = 8;

/**
 * Lightweight portal-based tooltip for small UI elements (table cells,
 * chips, etc). Same measure-then-clamp positioning approach as
 * `GambitTooltip` but generic — the caller supplies the content.
 *
 * Renders into `document.body` so it escapes parent `overflow: hidden`
 * / `overflow: auto` containers.
 */
export function CellTooltip({
  content,
  children,
  width = 200,
}: CellTooltipProps) {
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
    const tw = tip.offsetWidth || width;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: center on trigger, clamp to viewport.
    let left = tr.left + tr.width / 2 - tw / 2;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(vw - tw - VIEWPORT_MARGIN, left),
    );

    // Vertical: prefer above; fall back to below if it'd clip.
    let top = tr.top - OFFSET - th;
    if (top < VIEWPORT_MARGIN) {
      const below = tr.bottom + OFFSET;
      if (below + th <= vh - VIEWPORT_MARGIN) {
        top = below;
      } else {
        const spaceAbove = tr.top;
        const spaceBelow = vh - tr.bottom;
        top =
          spaceAbove >= spaceBelow
            ? Math.max(VIEWPORT_MARGIN, tr.top - OFFSET - th)
            : Math.min(vh - th - VIEWPORT_MARGIN, tr.bottom + OFFSET);
      }
    }
    setPos({ left, top });
  }, [width]);

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
              width,
              opacity: pos ? 1 : 0,
            }}
            className="pointer-events-none z-50 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 py-2 text-[11px] leading-snug text-[var(--color-wine-dark)] shadow-[0_3px_0_0_var(--color-ink)]"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
