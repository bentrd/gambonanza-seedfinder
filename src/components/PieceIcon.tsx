import type { Piece } from "../rng";

interface PieceIconProps {
  piece: Piece;
  variant?: "w" | "b";
  /** Approximate bounding-box size in CSS px. Pieces preserve their in-game
   *  pixel dimensions relative to each other; the tallest sprite hits this size. */
  size?: number;
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
  const scale = size / MAX_H;
  const dim = DIMS[piece];
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
