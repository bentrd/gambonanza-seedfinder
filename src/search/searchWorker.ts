/// <reference lib="webworker" />
import init, { search_range } from "../../rng-wasm/pkg/rng_wasm";
import type { SearchEvent, WorkerCommand } from "./types";

const RESULT_CAPACITY = 4096;
const PROGRESS_INTERVAL_MS = 200;
const CHUNK_SIZE = 1_000_000;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let stopRequested = false;
let initialized: Promise<void> | null = null;

async function ensureWasm(): Promise<void> {
  if (!initialized) initialized = init().then(() => undefined);
  return initialized;
}

function post(event: SearchEvent, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    ctx.postMessage(event, transfer);
  } else {
    ctx.postMessage(event);
  }
}

ctx.addEventListener("message", (e: MessageEvent<WorkerCommand>) => {
  const msg = e.data;
  if (msg.cmd === "stop") {
    stopRequested = true;
    return;
  }
  if (msg.cmd === "start") {
    stopRequested = false;
    void runSearch(msg.workerId, msg.seedStart, msg.seedEnd, msg.filters);
  }
});

async function runSearch(
  workerId: number,
  seedStart: number,
  seedEnd: number,
  filters: Uint32Array,
): Promise<void> {
  try {
    await ensureWasm();
  } catch (error: unknown) {
    post({
      type: "error",
      workerId,
      message: error instanceof Error ? error.message : "wasm init failed",
    });
    return;
  }

  let total = 0;
  let cursor = seedStart >>> 0;
  const end = seedEnd >>> 0;
  let lastProgressAt = performance.now();

  while (cursor < end && !stopRequested) {
    const chunkEnd = Math.min(cursor + CHUNK_SIZE, end) >>> 0;
    const out = new Uint32Array(RESULT_CAPACITY);
    const found = search_range(cursor, chunkEnd, filters, out);

    if (found > 0) {
      const seeds = Array.from(out.subarray(0, found));
      post({ type: "results", seeds, workerId });
      total += found;
    }

    cursor = chunkEnd;
    const now = performance.now();
    if (now - lastProgressAt > PROGRESS_INTERVAL_MS) {
      post({
        type: "progress",
        progress: {
          scanned: cursor - seedStart,
          matched: total,
          rangeStart: seedStart,
          rangeEnd: end,
          workerId,
        },
      });
      lastProgressAt = now;
    }
  }

  post({
    type: "progress",
    progress: {
      scanned: cursor - seedStart,
      matched: total,
      rangeStart: seedStart,
      rangeEnd: end,
      workerId,
    },
  });
  post({ type: "done", workerId, total });
}
