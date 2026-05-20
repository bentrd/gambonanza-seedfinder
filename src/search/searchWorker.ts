/// <reference lib="webworker" />
import init, { search_paginated } from "../../rng-wasm/pkg/rng_wasm";
import type { SearchEvent, WorkerCommand } from "./types";

/**
 * Per-call output capacity. Caps the worst-case overshoot when the
 * `target` count is small: the kernel writes at most `RESULT_CAPACITY`
 * matches per inner-loop invocation, so we re-check the target after
 * each kernel call rather than scanning a giant chunk.
 */
const RESULT_CAPACITY = 128;
/** 2^32 — the size of the u32 seed space. Not the value we pass to wasm
 *  (it doesn't fit in u32); used only for "scanned"/`cursor` math here. */
const U32_RANGE = 0x100000000;
/** Sentinel passed as `seed_end` to mean "no upper bound — scan to the
 *  end of the u32 space". The Rust kernel handles this explicitly. */
const NO_END: number = 0;
const PROGRESS_INTERVAL_MS = 150;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface Session {
  filters: Uint32Array;
  cursor: number;
  matched: number;
  scanned: number;
  exhausted: boolean;
}

let session: Session | null = null;
let stopRequested = false;
let initialized: Promise<void> | null = null;
let running = false;

async function ensureWasm(): Promise<void> {
  if (!initialized) initialized = init().then(() => undefined);
  return initialized;
}

function post(event: SearchEvent): void {
  ctx.postMessage(event);
}

ctx.addEventListener("message", (e: MessageEvent<WorkerCommand>) => {
  const msg = e.data;
  if (msg.cmd === "stop") {
    stopRequested = true;
    session = null;
    return;
  }
  if (msg.cmd === "start") {
    stopRequested = false;
    session = {
      filters: msg.filters,
      cursor: msg.seedStart >>> 0,
      matched: 0,
      scanned: 0,
      exhausted: false,
    };
    void runBatch(msg.target);
    return;
  }
  if (msg.cmd === "resume") {
    if (!session || session.exhausted) return;
    stopRequested = false;
    void runBatch(session.matched + msg.additional);
    return;
  }
});

/**
 * Scan until the worker's running `matched` count reaches `targetTotal`
 * or the seed space is exhausted. Posts `results` along the way,
 * `paused` on success, `exhausted` if we ran out of seeds, or `error`
 * on failure. After a `paused` or `exhausted` event the session stays
 * alive so a subsequent `resume` can pick up the cursor.
 */
async function runBatch(targetTotal: number): Promise<void> {
  if (running) return; // resume race — caller should never overlap, but guard anyway.
  if (!session) return;
  running = true;

  try {
    await ensureWasm();
  } catch (err: unknown) {
    running = false;
    post({
      type: "error",
      message: err instanceof Error ? err.message : "wasm init failed",
    });
    return;
  }

  const s = session;
  let lastProgressAt = performance.now();
  const out = new Uint32Array(RESULT_CAPACITY);

  while (s.matched < targetTotal && !s.exhausted && !stopRequested) {
    const remaining = targetTotal - s.matched;
    const r = search_paginated(s.cursor, NO_END, s.filters, out, remaining);
    const written = r[0];
    const nextCursor = r[1];
    const scannedNow = computeScanned(s.cursor, nextCursor);
    s.scanned += scannedNow;
    s.cursor = nextCursor;

    if (written > 0) {
      const seeds = Array.from(out.subarray(0, written));
      s.matched += written;
      post({ type: "results", seeds });
    }

    // Rust returns nextCursor === 0 when the cursor wrapped off the top
    // of the u32 space (full sweep done from any non-zero start).
    if (nextCursor === 0 && s.cursor === 0) {
      s.exhausted = true;
      break;
    }

    const now = performance.now();
    if (now - lastProgressAt > PROGRESS_INTERVAL_MS) {
      post({
        type: "progress",
        matched: s.matched,
        scanned: s.scanned,
        cursor: s.cursor,
      });
      lastProgressAt = now;
    }
  }

  running = false;
  if (stopRequested) {
    // The caller will spawn a new worker if it needs to start over;
    // nothing to emit here.
    return;
  }
  if (s.exhausted) {
    post({ type: "exhausted", matched: s.matched, scanned: s.scanned });
    return;
  }
  post({
    type: "paused",
    matched: s.matched,
    scanned: s.scanned,
    cursor: s.cursor,
  });
}

/**
 * Scanned-seed count for a single kernel call. Handles the rare case
 * where the cursor wraps to 0 after sweeping the whole u32 space.
 */
function computeScanned(prevCursor: number, nextCursor: number): number {
  if (nextCursor === 0 && prevCursor !== 0) {
    return U32_RANGE - prevCursor;
  }
  return Math.max(0, nextCursor - prevCursor);
}
