import type { Piece } from "../rng";

interface PieceIconProps {
  piece: Piece;
  variant?: "w" | "b";
  /** Approximate bounding-box size in CSS px. Pieces preserve their in-game
   *  pixel dimensions relative to each other; the tallest sprite hits this size.
   *  Pass `null` to use percentage-based sizing controlled by the caller's
   *  className (e.g. `h-7 sm:h-9`) - useful for responsive layouts where the
   *  icon should track the breakpoint without prop juggling. */
  size?: number | null;
  className?: string;
}

const FILE: Record<Piece, string> = {
  PAWN: "pawn",
  ROOK: "rook",
  KNIGHT: "knight",
  BISHOP: "bishop",
  QUEEN: "queen",
  KING: "king",
};

// Native sprite dimensions extracted from the game assets (px).
const DIMS: Record<Piece, { w: number; h: number }> = {
  PAWN:   { w: 21, h: 23 },
  ROOK:   { w: 21, h: 25 },
  KNIGHT: { w: 23, h: 26 },
  BISHOP: { w: 21, h: 30 },
  QUEEN:  { w: 27, h: 25 },
  KING:   { w: 23, h: 24 },
};

const MAX_W = 27;
const MAX_H = 30;

export function PieceIcon({ piece, variant = "w", size = 28, className = "" }: PieceIconProps) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const src = `${base}/game/pieces/${FILE[piece]}_${variant}.png`;
  const dim = DIMS[piece];

  // Responsive mode - wrapper height comes from `className` (e.g. `h-6 sm:h-9`),
  // wrapper width tracks via aspect-ratio, and the img sits inside at the
  // correct percentage of that box.
  if (size === null) {
    return (
      <span
        className={`inline-flex shrink-0 items-end justify-center ${className}`}
        style={{ aspectRatio: `${MAX_W} / ${MAX_H}` }}
      >
        <img
          src={src}
          alt={piece}
          className="pixel block select-none"
          style={{
            width: `${(dim.w / MAX_W) * 100}%`,
            height: `${(dim.h / MAX_H) * 100}%`,
          }}
          draggable={false}
        />
      </span>
    );
  }

  const scale = size / MAX_H;
  const wrapW = Math.round(MAX_W * scale);
  const wrapH = Math.round(MAX_H * scale);
  const imgW = Math.round(dim.w * scale);
  const imgH = Math.round(dim.h * scale);
  return (
    <span
      className={`inline-flex shrink-0 items-end justify-center ${className}`}
      style={{ width: wrapW, height: wrapH }}
    >
      <img
        src={src}
        alt={piece}
        className="pixel block select-none"
        style={{ width: imgW, height: imgH }}
        draggable={false}
      />
    </span>
  );
}
