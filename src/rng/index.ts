import init, {
  gachaponRoll as wasmGachaponRoll,
  predictGachaponGambits as wasmPredictGachaponGambits,
  simulateStarters as wasmSimulateStarters,
} from "../../rng-wasm/pkg/rng_wasm";
import { PIECES } from "./types";
import type { Piece, Rarity } from "./types";
import { getGambitByPoolIndex } from "./gambits";
import type { Gambit } from "./gambits";

export type { Piece, Rarity, Gambit };
export { PIECES, RARITIES } from "./types";
export {
  gambitDescriptionPlain,
  gambitDisplayName,
  gambitSpriteUrl,
  getGambitById,
  getGambitByPoolIndex,
  getGambits,
  loadGambits,
} from "./gambits";

let ready: Promise<void> | null = null;

/** Idempotent — call before any RNG function. main.tsx awaits this once. */
export function initRng(): Promise<void> {
  if (!ready) ready = init().then(() => undefined);
  return ready;
}

export interface StarterRoll {
  lo: number;
  num: number;
  piece: Piece;
}

export function simulateStarters(seed: number): StarterRoll[] {
  const flat = wasmSimulateStarters(seed);
  const out: StarterRoll[] = [];
  for (let i = 0; i < 3; i++) {
    out.push({
      lo: flat[i * 3],
      num: flat[i * 3 + 1],
      piece: PIECES[flat[i * 3 + 2]],
    });
  }
  return out;
}

export function gachaponRoll(
  seed: number,
  wave: number,
  counter: number,
): number {
  return wasmGachaponRoll(seed, wave, counter);
}

export function rarityTier(roll: number): Rarity {
  if (roll > 89) return "LEGENDARY";
  if (roll > 69) return "EPIC";
  if (roll > 39) return "RARE";
  return "COMMON";
}

export interface GachaponPick {
  /** Gachapon index (0-based; gachapon #1 is index 0). */
  gachIdx: number;
  /** Wave the gachapon opened at, under the wave = gachIdx+1 model. */
  wave: number;
  /** Raw 0..100 rarity roll. */
  rarityRoll: number;
  rarity: Rarity;
  /** The 3 gambit picks shown to the player. `null` if the pool ran out. */
  picks: [Gambit | null, Gambit | null, Gambit | null];
}

/**
 * Predict the 3 gambits offered by the Nth gachapon (0-indexed). The
 * pool can be filtered by passing `excludedIds` — gambits the player
 * hasn't unlocked, currently has equipped, etc. — encoded by
 * `encodeExcludedIds` (see `src/search/encode.ts`). Requires
 * `loadGambits()` to have resolved.
 */
export function predictGachapon(
  seed: number,
  gachIdx: number,
  excluded: Uint32Array = EMPTY_U32,
): GachaponPick {
  const flat = wasmPredictGachaponGambits(seed >>> 0, gachIdx >>> 0, excluded);
  const rarityIdx = flat[0];
  const rarity = (["COMMON", "RARE", "EPIC", "LEGENDARY"] as const)[rarityIdx];
  const picks = [0, 1, 2].map((i) => {
    const pi = flat[1 + i];
    if (pi < 0 || pi === 255) return null;
    return getGambitByPoolIndex(rarity, pi) ?? null;
  }) as [Gambit | null, Gambit | null, Gambit | null];
  return {
    gachIdx,
    wave: gachIdx + 1,
    rarityRoll: flat[4],
    rarity,
    picks,
  };
}

const EMPTY_U32 = new Uint32Array(0);
