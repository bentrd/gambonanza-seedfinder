import { encodeFilters } from "./encode";
import type {
  SearchEvent,
  SearchFilters,
  WorkerCommand,
} from "./types";

interface ManagerOptions {
  /** Batch size - added to the running target each time `requestNext` is called. */
  batchSize?: number;
  onResult: (seeds: number[]) => void;
  /** Fires on in-batch progress AND when a batch resolves (paused/exhausted). */
  onProgress: (state: ManagerProgress) => void;
  /** Worker hit the seed-space ceiling. No further `requestNext` will produce matches. */
  onExhausted: () => void;
  /** Worker has satisfied a batch target and is idle until `requestNext`. */
  onPaused: () => void;
  onError: (message: string) => void;
}

export interface ManagerProgress {
  matched: number;
  scanned: number;
  cursor: number;
  /** Sum of batch targets requested so far. */
  target: number;
  exhausted: boolean;
}

/**
 * Single-worker paginated search driver. The worker is kept alive
 * between batches; each `requestNext()` posts a `resume` command for
 * another `batchSize` matches. `start(filters)` resets everything and
 * begins from seed 1.
 *
 * We dropped the previous 4-way parallel partitioning when we moved to
 * pagination - running 4 workers in parallel made the result order
 * non-deterministic AND made resuming a cursor-per-worker mess. Single
 * worker, single cursor, results in strict seed order.
 */
export class SearchManager {
  private worker: Worker | null = null;
  private opts: ManagerOptions;
  private batchSize: number;
  private state: ManagerProgress;

  constructor(opts: ManagerOptions) {
    this.opts = opts;
    this.batchSize = opts.batchSize ?? 100;
    this.state = {
      matched: 0,
      scanned: 0,
      cursor: 1,
      target: 0,
      exhausted: false,
    };
  }

  /** Begin a fresh search. Terminates any prior worker first. */
  start(filters: SearchFilters): void {
    this.cancel();
    const encoded = encodeFilters(filters);
    this.state = {
      matched: 0,
      scanned: 0,
      cursor: 1,
      target: this.batchSize,
      exhausted: false,
    };
    this.spawnWorker();
    const cmd: WorkerCommand = {
      cmd: "start",
      seedStart: 1,
      filters: encoded,
      target: this.batchSize,
    };
    this.worker!.postMessage(cmd);
    this.emitProgress();
  }

  /** Ask the worker to scan for `batchSize` additional matches. */
  requestNext(): void {
    if (!this.worker || this.state.exhausted) return;
    this.state.target += this.batchSize;
    const cmd: WorkerCommand = { cmd: "resume", additional: this.batchSize };
    this.worker.postMessage(cmd);
    this.emitProgress();
  }

  /** Tear down the worker (e.g. on filter change or app unmount). */
  cancel(): void {
    if (this.worker) {
      try {
        this.worker.postMessage({ cmd: "stop" } satisfies WorkerCommand);
      } catch {
        // ignore - terminating anyway
      }
      this.worker.terminate();
      this.worker = null;
    }
  }

  /** Current accumulated progress (for sync reads). */
  getProgress(): ManagerProgress {
    return { ...this.state };
  }

  private spawnWorker(): void {
    const worker = new Worker(
      new URL("./searchWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener("message", (e) => this.onMessage(e.data));
    worker.addEventListener("error", (e) => {
      this.opts.onError(e.message || "worker error");
    });
    this.worker = worker;
  }

  private onMessage(event: SearchEvent): void {
    switch (event.type) {
      case "results":
        this.opts.onResult(event.seeds);
        break;
      case "progress":
        this.state.matched = event.matched;
        this.state.scanned = event.scanned;
        this.state.cursor = event.cursor;
        this.emitProgress();
        break;
      case "paused":
        this.state.matched = event.matched;
        this.state.scanned = event.scanned;
        this.state.cursor = event.cursor;
        this.emitProgress();
        this.opts.onPaused();
        break;
      case "exhausted":
        this.state.matched = event.matched;
        this.state.scanned = event.scanned;
        this.state.exhausted = true;
        this.emitProgress();
        this.opts.onExhausted();
        break;
      case "error":
        this.opts.onError(event.message);
        break;
    }
  }

  private emitProgress(): void {
    this.opts.onProgress({ ...this.state });
  }
}
