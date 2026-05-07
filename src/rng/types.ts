export const PIECES = [
  "PAWN",
  "ROOK",
  "KNIGHT",
  "BISHOP",
  "QUEEN",
  "KING",
] as const;
export type Piece = (typeof PIECES)[number];

export const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;
export type Rarity = (typeof RARITIES)[number];
