import type { Piece, Rarity } from "../rng";

export type StarterSlot = Piece | "ANY";

export interface StarterFilter {
  slots: [StarterSlot, StarterSlot, StarterSlot];
  unordered: boolean;
}

export interface GachaponFilter {
  wave: number;
  counter: number;
  tierMin: Rarity;
  tierMax: Rarity;
  rollMin: number;
  rollMax: number;
}

export interface GambitFilter {
  /** Internal IDs (`Gambit.id`) of gambits to match. Empty = filter disabled. */
  targets: string[];
  /** Match within the first N gachapons opened (1..32). */
  maxGachapons: number;
  /** IDs the player does NOT have unlocked — removed from every gachapon pool. */
  excludedIds: string[];
}

export interface SearchFilters {
  starter: StarterFilter;
  gachapons: GachaponFilter[];
  gambits: GambitFilter;
}

/* -------------------- Worker ↔ main protocol -------------------- */

/** Aggregate progress for the UI status pane. */
export interface SearchProgress {
  /** Total matches collected so far across all completed batches. */
  matched: number;
  /** Total seeds scanned so far across all batches. */
  scanned: number;
  /** Highest seed value the cursor has reached. */
  cursor: number;
  /** Sum of batch targets requested so far (100, 200, 300, …). */
  target: number;
}

export type SearchEvent =
  /** A burst of matches found within the current batch. */
  | { type: "results"; seeds: number[] }
  /** Worker has fulfilled the requested batch target; awaiting next call. */
  | { type: "paused"; matched: number; scanned: number; cursor: number }
  /** Worker walked off the top of the u32 seed space — no more matches possible. */
  | { type: "exhausted"; matched: number; scanned: number }
  /** Periodic in-batch tick so the status pane animates while a slow batch runs. */
  | { type: "progress"; matched: number; scanned: number; cursor: number }
  | { type: "error"; message: string };

export type WorkerCommand =
  /** Start a fresh search from `seedStart`. Worker scans until `target` matches written. */
  | {
      cmd: "start";
      seedStart: number;
      filters: Uint32Array;
      target: number;
    }
  /** Continue from the worker's saved cursor for `additional` more matches. */
  | { cmd: "resume"; additional: number }
  /** Abort the current batch and discard worker state. */
  | { cmd: "stop" };
