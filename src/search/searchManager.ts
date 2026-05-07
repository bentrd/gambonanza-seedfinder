import { encodeFilters } from "./encode";
import type { SearchEvent, SearchFilters, WorkerCommand } from "./types";

interface ManagerOptions {
  workerCount?: number;
  rangeStart?: number;
  rangeEnd?: number;
  onResult: (seeds: number[]) => void;
  onProgress: (scanned: number, matched: number, total: number) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

const TOTAL_RANGE = 0x100000000;

export class SearchManager {
  private workers: Worker[] = [];
  private opts: ManagerOptions;
  private pendingScans = new Map<number, { scanned: number; matched: number; size: number }>();
  private active = false;

  constructor(opts: ManagerOptions) {
    this.opts = opts;
  }

  start(filters: SearchFilters): void {
    this.cancel();
    const encoded = encodeFilters(filters);
    const start = this.opts.rangeStart ?? 1;
    const end = this.opts.rangeEnd ?? TOTAL_RANGE;
    const count = this.opts.workerCount ?? 4;
    const span = end - start;
    const slice = Math.ceil(span / count);

    this.active = true;
    this.pendingScans.clear();

    for (let i = 0; i < count; i++) {
      const sStart = (start + i * slice) >>> 0;
      const sEnd = Math.min(start + (i + 1) * slice, end) >>> 0;
      if (sStart >= sEnd) continue;

      const worker = new Worker(
        new URL("./searchWorker.ts", import.meta.url),
        { type: "module" },
      );
      worker.addEventListener("message", (e) => this.onMessage(e.data));
      worker.addEventListener("error", (e) => {
        this.opts.onError(e.message || "worker error");
      });

      const cmd: WorkerCommand = {
        cmd: "start",
        seedStart: sStart,
        seedEnd: sEnd,
        filters: encoded,
        workerId: i,
      };
      worker.postMessage(cmd);
      this.workers.push(worker);
      this.pendingScans.set(i, { scanned: 0, matched: 0, size: sEnd - sStart });
    }
  }

  cancel(): void {
    if (!this.active) return;
    this.active = false;
    const stop: WorkerCommand = { cmd: "stop" };
    for (const w of this.workers) {
      try {
        w.postMessage(stop);
      } catch {
        // ignore
      }
      w.terminate();
    }
    this.workers = [];
    this.pendingScans.clear();
  }

  private onMessage(event: SearchEvent): void {
    if (!this.active) return;
    if (event.type === "results") {
      this.opts.onResult(event.seeds);
    } else if (event.type === "progress") {
      this.pendingScans.set(event.progress.workerId, {
        scanned: event.progress.scanned,
        matched: event.progress.matched,
        size: event.progress.rangeEnd - event.progress.rangeStart,
      });
      this.emitAggregate();
    } else if (event.type === "done") {
      const slot = this.pendingScans.get(event.workerId);
      if (slot) {
        slot.scanned = slot.size;
        slot.matched = event.total;
        this.pendingScans.set(event.workerId, slot);
      }
      this.emitAggregate();
      const allDone = Array.from(this.pendingScans.values()).every(
        (s) => s.scanned >= s.size,
      );
      if (allDone) {
        this.active = false;
        this.opts.onDone();
      }
    } else if (event.type === "error") {
      this.opts.onError(event.message);
    }
  }

  private emitAggregate(): void {
    let scanned = 0;
    let matched = 0;
    let total = 0;
    for (const s of this.pendingScans.values()) {
      scanned += s.scanned;
      matched += s.matched;
      total += s.size;
    }
    this.opts.onProgress(scanned, matched, total);
  }
}
