import type { Piece, Rarity } from "../rng";
import { getGambitById, PIECES, RARITIES } from "../rng";
import type { GachaponFilter, GambitFilter, SearchFilters, StarterSlot } from "./types";

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

function packGambit(id: string): number | null {
  const g = getGambitById(id);
  if (!g) return null;
  const rarity = RARITY_INDEX[g.rarity];
  // bits[0..2]=rarity, bits[8..16]=poolIndex
  return ((g.poolIndex & 0xff) << 8) | (rarity & 0x3);
}

/** Encode the exclusion list (Gambit IDs) to the wire format used by the
 *  Rust kernel and `predictGachapon`. Exposed so the inspector can pass
 *  the same bytes to the WASM inspector function. */
export function encodeExcludedIds(ids: readonly string[]): Uint32Array {
  if (ids.length === 0) return new Uint32Array(0);
  const out: number[] = [];
  for (const id of ids) {
    const w = packGambit(id);
    if (w !== null) out.push(w);
  }
  return new Uint32Array(out);
}

export function encodeFilters(filters: SearchFilters): Uint32Array {
  const numGach = Math.min(filters.gachapons.length, 32);

  const gambitTargets: number[] = [];
  for (const id of filters.gambits.targets) {
    const w = packGambit(id);
    if (w !== null) gambitTargets.push(w);
  }
  const hasGambit = gambitTargets.length > 0;
  const gambitMatchAll = filters.gambits.matchMode === "all";
  const gambitSectionLen = hasGambit ? 1 + gambitTargets.length : 0;

  const excluded: number[] = [];
  for (const id of filters.gambits.excludedIds) {
    const w = packGambit(id);
    if (w !== null) excluded.push(w);
  }
  const hasExcl = excluded.length > 0;
  const exclSectionLen = hasExcl ? 1 + excluded.length : 0;

  const buf = new Uint32Array(1 + numGach * 2 + gambitSectionLen + exclSectionLen);

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
  header |= (hasGambit ? 1 : 0) << 13;
  header |= (hasExcl ? 1 : 0) << 14;
  header |= (hasGambit && gambitMatchAll ? 1 : 0) << 15;
  header |= (numGach & 0xff) << 16;
  if (hasGambit) {
    const maxGach = clamp(filters.gambits.maxGachapons, 1, 32);
    header |= (maxGach & 0xff) << 24;
  }
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

  let cursor = 1 + numGach * 2;
  if (hasGambit) {
    buf[cursor] = gambitTargets.length >>> 0;
    for (let i = 0; i < gambitTargets.length; i++) {
      buf[cursor + 1 + i] = gambitTargets[i] >>> 0;
    }
    cursor += 1 + gambitTargets.length;
  }
  if (hasExcl) {
    buf[cursor] = excluded.length >>> 0;
    for (let i = 0; i < excluded.length; i++) {
      buf[cursor + 1 + i] = excluded[i] >>> 0;
    }
  }

  return buf;
}

export function defaultGambitFilter(): GambitFilter {
  return { targets: [], matchMode: "any", maxGachapons: 5, excludedIds: [] };
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
