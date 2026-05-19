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

export interface SearchProgress {
  scanned: number;
  matched: number;
  rangeStart: number;
  rangeEnd: number;
  workerId: number;
}

export type SearchEvent =
  | { type: "results"; seeds: number[]; workerId: number }
  | { type: "progress"; progress: SearchProgress }
  | { type: "done"; workerId: number; total: number }
  | { type: "error"; workerId: number; message: string };

export interface WorkerCommandStart {
  cmd: "start";
  seedStart: number;
  seedEnd: number;
  filters: Uint32Array;
  workerId: number;
}

export interface WorkerCommandStop {
  cmd: "stop";
}

export type WorkerCommand = WorkerCommandStart | WorkerCommandStop;
