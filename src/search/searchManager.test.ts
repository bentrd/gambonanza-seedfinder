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
    };
    const hits = runSearch(filters, 1, 2_000_000, 32);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits).toContain(265473);
  });

  it("unordered match treats 3-pawn order-flips as equivalent", async () => {
    await loadWasm();
    const filters: SearchFilters = {
      starter: { slots: ["KING", "PAWN", "PAWN"], unordered: true },
      gachapons: [],
    };
    const hits = runSearch(filters, 1, 1000, 256);
    expect(hits.length).toBeGreaterThan(10);
    expect(hits).toContain(1);
  });
});
