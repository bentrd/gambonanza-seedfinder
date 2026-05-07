import init, {
  gachaponRoll as wasmGachaponRoll,
  simulateStarters as wasmSimulateStarters,
} from "../../rng-wasm/pkg/rng_wasm";
import { PIECES } from "./types";
import type { Piece, Rarity } from "./types";

export type { Piece, Rarity };
export { PIECES, RARITIES } from "./types";

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
