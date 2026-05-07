import type { Piece, Rarity } from "../rng";
import { PIECES, RARITIES } from "../rng";
import type { GachaponFilter, SearchFilters, StarterSlot } from "./types";

const PIECE_INDEX: Record<Piece, number> = {
  PAWN: 0,
  ROOK: 1,
  KNIGHT: 2,
  BISHOP: 3,
  QUEEN: 4,
  KING: 5,
};

const RARITY_INDEX: Record<Rarity, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
};

function encodeSlot(slot: StarterSlot): { piece: number; isAny: number } {
  if (slot === "ANY") return { piece: 0, isAny: 1 };
  return { piece: PIECE_INDEX[slot], isAny: 0 };
}

export function encodeFilters(filters: SearchFilters): Uint32Array {
  const numGach = Math.min(filters.gachapons.length, 32);
  const buf = new Uint32Array(1 + numGach * 2);

  const s0 = encodeSlot(filters.starter.slots[0]);
  const s1 = encodeSlot(filters.starter.slots[1]);
  const s2 = encodeSlot(filters.starter.slots[2]);

  let header = 0;
  header |= (s0.piece & 0x7) << 0;
  header |= (s0.isAny & 0x1) << 3;
  header |= (s1.piece & 0x7) << 4;
  header |= (s1.isAny & 0x1) << 7;
  header |= (s2.piece & 0x7) << 8;
  header |= (s2.isAny & 0x1) << 11;
  header |= (filters.starter.unordered ? 1 : 0) << 12;
  header |= (numGach & 0xff) << 16;
  buf[0] = header >>> 0;

  for (let i = 0; i < numGach; i++) {
    const g = filters.gachapons[i];
    buf[1 + i * 2] = g.wave >>> 0;

    const tierMin = RARITY_INDEX[g.tierMin];
    const tierMax = RARITY_INDEX[g.tierMax];
    let packed = 0;
    packed |= (g.counter & 0xff) << 0;
    packed |= (tierMin & 0x3) << 8;
    packed |= (tierMax & 0x3) << 10;
    packed |= (clamp(g.rollMin, 0, 100) & 0xff) << 16;
    packed |= (clamp(g.rollMax, 0, 100) & 0xff) << 24;
    buf[1 + i * 2 + 1] = packed >>> 0;
  }
  return buf;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v | 0));
}

export function defaultGachapon(index: number): GachaponFilter {
  return {
    wave: index + 1,
    counter: index,
    tierMin: "COMMON",
    tierMax: "LEGENDARY",
    rollMin: 0,
    rollMax: 100,
  };
}

export const ALL_PIECES: readonly Piece[] = PIECES;
export const ALL_RARITIES: readonly Rarity[] = RARITIES;
