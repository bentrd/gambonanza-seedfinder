import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import init, { search_range } from "../../rng-wasm/pkg/rng_wasm";
import { encodeFilters } from "./encode";
import type { SearchFilters } from "./types";

async function loadWasm(): Promise<void> {
  const wasmPath = fileURLToPath(
    new URL("../../rng-wasm/pkg/rng_wasm_bg.wasm", import.meta.url),
  );
  const bytes = readFileSync(wasmPath);
  await init({ module_or_path: bytes });
}

const NO_GAMBITS = {
  targets: [] as string[],
  maxGachapons: 5,
  excludedIds: [] as string[],
};

function runSearch(filters: SearchFilters, start: number, end: number, capacity = 256): number[] {
  const buf = encodeFilters(filters);
  const out = new Uint32Array(capacity);
  const found = search_range(start >>> 0, end >>> 0, buf, out);
  return Array.from(out.subarray(0, found));
}

describe("WASM search_range end-to-end", () => {
  it("finds the lowest triple-queen seed (798)", async () => {
    await loadWasm();
    const filters: SearchFilters = {
      starter: { slots: ["QUEEN", "QUEEN", "QUEEN"], unordered: false },
      gachapons: [],
      gambits: NO_GAMBITS,
    };
    const hits = runSearch(filters, 1, 1000, 16);
    expect(hits[0]).toBe(798);
  });

  it("filters by gachapon legendary at slot #1", async () => {
    await loadWasm();
    const filters: SearchFilters = {
      starter: { slots: ["QUEEN", "QUEEN", "QUEEN"], unordered: false },
      gachapons: [
        {
          wave: 1,
          counter: 0,
          tierMin: "LEGENDARY",
          tierMax: "LEGENDARY",
          rollMin: 0,
          rollMax: 100,
        },
      ],
      gambits: NO_GAMBITS,
    };
    const hits = runSearch(filters, 1, 2_000_000, 32);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits).toContain(265473);
  });

  // Verifies the trajectory-aware gambit filter. For seed 2 the
  // "spin every GAMBIT slot" trajectory's 5th spin lands at wave 7
  // with rarity LEGENDARY (roll=90) and picks [10, 11, 14] — index 14
  // = LuckyCoin. (Found via predict_gambits.py with trajectory mode.)
  //
  // Conversely, seed 8308's old diagonal hit at (W=5, C=4) is now
  // correctly rejected: the trajectory's spin sequence for seed 8308
  // tops out at counter=3 (4 GAMBIT slots across waves 1-8), so the
  // 5th spin doesn't exist for that seed.
  it("matches a known seed via gambit filter (LuckyCoin within 5 trajectory spins)", async () => {
    await loadWasm();
    const targetWord = ((14 & 0xff) << 8) | 3; // poolIndex=14, rarity=LEGENDARY
    const buf = new Uint32Array(1 + 2);
    let header = 0;
    header |= 1 << 3;   // s0 any
    header |= 1 << 7;   // s1 any
    header |= 1 << 11;  // s2 any
    header |= 1 << 13;  // has_gambit
    header |= 5 << 24;  // gambit_max_gach
    buf[0] = header >>> 0;
    buf[1] = 1;                          // num_targets
    buf[2] = targetWord >>> 0;

    const out = new Uint32Array(64);
    expect(
      Array.from(out.subarray(0, search_range(2, 3, buf, out))),
    ).toEqual([2]);

    // Seed 8308 should NOT match anymore — the old diagonal hit was
    // unreachable under the trajectory.
    const out2 = new Uint32Array(64);
    expect(
      Array.from(out2.subarray(0, search_range(8308, 8309, buf, out2))),
    ).toEqual([]);
  });

  it("unordered match treats 3-pawn order-flips as equivalent", async () => {
    await loadWasm();
    const filters: SearchFilters = {
      starter: { slots: ["KING", "PAWN", "PAWN"], unordered: true },
      gachapons: [],
      gambits: NO_GAMBITS,
    };
    const hits = runSearch(filters, 1, 1000, 256);
    expect(hits.length).toBeGreaterThan(10);
    expect(hits).toContain(1);
  });
});
