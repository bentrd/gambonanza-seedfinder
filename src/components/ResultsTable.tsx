import { useEffect, useMemo, useRef, useState } from "react";
import {
  gachaponRoll,
  gambitDisplayName,
  gambitSpriteUrl,
  predictGachaponAt,
  predictShopTokens,
  rarityTier,
  simulateStarters,
} from "../rng";
import type { Gambit, ShopTokens, TokenType } from "../rng";
import { TIER_BG } from "../rng/rarityColors";
import { encodeExcludedIds } from "../search/encode";
import type { GachaponFilter, GambitFilter } from "../search/types";
import { PieceIcon } from "./PieceIcon";
import { CopyButton } from "./ui/CopyButton";
import { RarityBadge } from "./ui/RarityBadge";
import { CellTooltip } from "./ui/CellTooltip";

interface ResultsTableProps {
  seeds: number[];
  gachaponFilters: GachaponFilter[];
  gambitFilter: GambitFilter;
  /** Worker is currently scanning a batch. Disables the sentinel trigger. */
  fetching: boolean;
  /** No more seeds left to scan — sentinel becomes terminal. */
  exhausted: boolean;
  /** Whether any search has been initiated yet (empty results before first run vs after). */
  hasSearched: boolean;
  /** Callback when the sentinel scrolls into view (request the next batch). */
  onLoadMore: () => void;
}

export function ResultsTable({
  seeds,
  gachaponFilters,
  gambitFilter,
  fetching,
  exhausted,
  hasSearched,
  onLoadMore,
}: ResultsTableProps) {
  const excludedBytes = useMemo(
    () => encodeExcludedIds(gambitFilter.excludedIds),
    [gambitFilter.excludedIds],
  );

  if (seeds.length === 0 && !hasSearched) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-[var(--color-cream-soft)]/40 text-sm uppercase tracking-wider text-[var(--color-wine-dark)]/70">
        Set your filters and hit Search.
      </div>
    );
  }

  // Even with 0 results, when a search has started we still render the
  // shell so the user sees the "no matches" sentinel.
  return (
    <div className="overflow-hidden rounded-lg border-2 border-[var(--color-ink)]">
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm text-[var(--color-wine-dark)]">
          <thead className="sticky top-0 z-10 bg-[var(--color-wine)] text-[11px] uppercase tracking-wider text-[var(--color-cream)] shadow-[0_2px_0_0_var(--color-ink)]">
            <tr>
              <th className="px-3 py-2 text-left">Seed</th>
              <th className="px-3 py-2 text-left">Starters</th>
              {gachaponFilters.map((g, i) => (
                <th key={i} className="px-2 py-2 text-left">
                  <span className="block font-display lowercase">
                    gach #{i + 1}
                  </span>
                  <span className="block font-mono text-[10px] normal-case opacity-80">
                    w{g.wave} c{g.counter}
                  </span>
                </th>
              ))}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {seeds.map((seed, idx) => (
              <ResultRow
                key={seed}
                seed={seed}
                gachaponFilters={gachaponFilters}
                gambitFilter={gambitFilter}
                excludedBytes={excludedBytes}
                striped={idx % 2 === 1}
              />
            ))}
            <SentinelRow
              colSpan={gachaponFilters.length + 3}
              fetching={fetching}
              exhausted={exhausted}
              hasResults={seeds.length > 0}
              onLoadMore={onLoadMore}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ResultRowProps {
  seed: number;
  gachaponFilters: GachaponFilter[];
  gambitFilter: GambitFilter;
  excludedBytes: Uint32Array;
  striped: boolean;
}

function ResultRow({
  seed,
  gachaponFilters,
  gambitFilter,
  excludedBytes,
  striped,
}: ResultRowProps) {
  const [open, setOpen] = useState(false);
  const starters = simulateStarters(seed);
  const rolls = gachaponFilters.map((g) => gachaponRoll(seed, g.wave, g.counter));

  return (
    <>
      <tr
        className={`cursor-pointer border-t-2 border-[var(--color-cream-soft)] hover:bg-[var(--color-cream-light)] ${
          striped ? "bg-[var(--color-cream-light)]/60" : ""
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-2 font-mono text-[var(--color-wine)]">{seed}</td>
        <td className="px-3 py-2">
          <span className="inline-flex items-end gap-1">
            {starters.map((s, i) => (
              <PieceIcon key={i} piece={s.piece} variant="w" size={24} />
            ))}
          </span>
        </td>
        {rolls.map((roll, i) => {
          const tier = rarityTier(roll);
          return (
            <td key={i} className="px-2 py-2">
              <RarityBadge rarity={tier} size="md" font="mono" className="gap-1">
                <span className="uppercase">{tier.slice(0, 3)}</span>
                <span>{roll.toString().padStart(2, " ")}</span>
              </RarityBadge>
            </td>
          );
        })}
        <td className="px-2 py-2 text-center text-sm font-bold text-[var(--color-wine)]">
          {open ? "−" : "+"}
        </td>
      </tr>
      {open && (
        <tr className="border-t-2 border-[var(--color-cream-soft)] bg-[var(--color-cream-light)]">
          <td colSpan={gachaponFilters.length + 3} className="px-3 py-3">
            <Inspector
              seed={seed}
              gambitFilter={gambitFilter}
              excludedBytes={excludedBytes}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function Inspector({
  seed,
  gambitFilter,
  excludedBytes,
}: {
  seed: number;
  gambitFilter: GambitFilter;
  excludedBytes: Uint32Array;
}) {
  const starters = simulateStarters(seed);
  const waves = [1, 2, 3, 4, 5, 6, 7, 8];
  const counters = [0, 1, 2, 3, 4];
  const shopTokens = useMemo(
    () => predictShopTokens(seed, waves.length),
    // `waves` is a stable literal; only seed actually changes per row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
  );
  const targetIds = useMemo(
    () => new Set(gambitFilter.targets),
    [gambitFilter.targets],
  );
  /** `priorGambits[w]` = total GAMBIT slots in shops 1..w (inclusive).
   *  A cell at (wave W, counter C) is reachable iff wave W has a
   *  GAMBIT AND `priorGambits[W-1] >= C` (the player could have
   *  accumulated `C` spins before arriving at W). */
  const priorGambits = useMemo(() => {
    const out = [0];
    let total = 0;
    for (const s of shopTokens) {
      total += s.gambitCount;
      out.push(total);
    }
    return out;
  }, [shopTokens]);

  return (
    <div className="space-y-3 text-[var(--color-wine-dark)]">
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="uppercase tracking-wider text-[var(--color-wine-dark)]/70">
          seed
        </span>
        <span className="text-[var(--color-wine)]">{seed}</span>
        <span className="text-[var(--color-wine-dark)]/60">
          (0x{seed.toString(16)})
        </span>
        <CopyButton value={seed.toString()} />
      </div>

      <div>
        <div className="mb-1 font-display text-xs uppercase tracking-wider">
          Starter rolls
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {starters.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-2 py-1.5 font-mono"
            >
              <span className="uppercase tracking-wider text-[var(--color-wine-dark)]/70">
                slot {i + 1}
              </span>
              <span>
                lo={s.lo} num={s.num.toString().padStart(2, " ")}
              </span>
              <PieceIcon piece={s.piece} variant="w" size={20} />
              <span className="uppercase text-[var(--color-wine)]">
                {s.piece}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline gap-3 font-display text-xs uppercase tracking-wider">
          <span>Gachapon roll grid (rows = counter, cols = wave)</span>
          <span className="text-[10px] normal-case text-[var(--color-wine-dark)]/60">
            hover a cell for that wave's shop tokens · faded columns
            have no gachapon token
          </span>
        </div>
        <table className="font-mono text-[11px]">
          <thead>
            <tr className="text-[var(--color-wine-dark)]/70">
              <th className="px-2 text-right">c\w</th>
              {waves.map((w) => {
                const shop = shopTokens[w - 1];
                const hasGambit = shop?.hasGambit ?? false;
                return (
                  <th
                    key={w}
                    className={`px-2 text-right ${
                      hasGambit ? "" : "opacity-40"
                    }`}
                    title={
                      hasGambit
                        ? `wave ${w}: gachapon token offered`
                        : `wave ${w}: NO gachapon token — unreachable`
                    }
                  >
                    {w}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {counters.map((c) => (
              <tr key={c}>
                <td className="px-2 text-right text-[var(--color-wine-dark)]/70">
                  {c}
                </td>
                {waves.map((w) => {
                  const roll = gachaponRoll(seed, w, c);
                  const tier = rarityTier(roll);
                  const shop = shopTokens[w - 1];
                  const priorMax = priorGambits[w - 1] ?? 0;
                  return (
                    <RollCell
                      key={w}
                      seed={seed}
                      wave={w}
                      counter={c}
                      roll={roll}
                      tier={tier}
                      shop={shop}
                      priorMax={priorMax}
                      excludedBytes={excludedBytes}
                      targetIds={targetIds}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SentinelRowProps {
  colSpan: number;
  fetching: boolean;
  exhausted: boolean;
  hasResults: boolean;
  onLoadMore: () => void;
}

/**
 * Bottom row of the results table — drives the "infinite scroll"
 * pagination. An IntersectionObserver watches the row; when it scrolls
 * into view AND we're idle (not fetching) AND there's more seed space
 * to scan, it requests the next batch.
 *
 * Also acts as the status line at the bottom of the table:
 *   - fetching   → "scanning for more…" with a subtle pulse
 *   - exhausted  → "no more matches in the seed space"
 *   - empty + ¬exhausted → "halted — refine filters or scroll to retry"
 *   - empty + exhausted  → "no matches anywhere"
 */
function SentinelRow({
  colSpan,
  fetching,
  exhausted,
  hasResults,
  onLoadMore,
}: SentinelRowProps) {
  const ref = useRef<HTMLTableRowElement | null>(null);
  // Latest values via refs so the observer callback doesn't need to
  // re-bind every render (the observer survives prop changes).
  const fetchingRef = useRef(fetching);
  const exhaustedRef = useRef(exhausted);
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => { fetchingRef.current = fetching; }, [fetching]);
  useEffect(() => { exhaustedRef.current = exhausted; }, [exhausted]);
  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            !fetchingRef.current &&
            !exhaustedRef.current
          ) {
            onLoadMoreRef.current();
          }
        }
      },
      { rootMargin: "0px 0px 200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const label = exhausted
    ? hasResults
      ? "scanned every seed — no more matches"
      : "no matches anywhere in the seed space"
    : fetching
      ? "scanning for more matches…"
      : hasResults
        ? "scroll for more"
        : "halted — refine filters or scroll to retry";

  return (
    <tr
      ref={ref}
      className={`border-t-2 border-[var(--color-cream-soft)] ${
        fetching ? "animate-pulse" : ""
      }`}
    >
      <td
        colSpan={colSpan}
        className="px-3 py-3 text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70"
      >
        {label}
      </td>
    </tr>
  );
}

const TOKEN_LABEL: Record<TokenType, string> = {
  GAMBIT: "gachapon",
  CHESS_PIECE: "wheel (piece)",
  TILE: "pachinko (tile)",
};

interface RollCellProps {
  seed: number;
  wave: number;
  counter: number;
  roll: number;
  tier: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  shop: ShopTokens | undefined;
  /** Total GAMBIT slots in shops 1..(wave-1). The player can reach
   *  `counter = C` at this wave only if `C ≤ priorMax`. */
  priorMax: number;
  /** Filter exclusion bytes — passed through to `predictGachaponAt`
   *  so the cell's picks reflect the user's locked pool. */
  excludedBytes: Uint32Array;
  /** Gambit IDs the user is searching for. Cells whose picks include
   *  any of these get a yellow highlight. */
  targetIds: Set<string>;
}

/**
 * A single cell in the gachapon roll grid. Renders the raw rarity
 * roll tinted by tier, and on hover shows the wave's shop tokens
 * (3 slots), the 3 predicted gambit picks for this exact cell, and a
 * reachability verdict.
 *
 * A cell is **reachable** iff:
 *   - this wave's shop offers ≥ 1 GAMBIT token (so a spin can happen), AND
 *   - the player could have accumulated `counter = C` spins before
 *     arriving here, i.e. total GAMBIT slots in shops 1..(wave−1) ≥ C.
 *
 * Unreachable cells are faded; reachable cells whose picks include
 * one of the user's target gambits get a chunky yellow border so the
 * user can scan the grid for hits.
 */
function RollCell({
  seed,
  wave,
  counter,
  roll,
  tier,
  shop,
  priorMax,
  excludedBytes,
  targetIds,
}: RollCellProps) {
  const waveHasGambit = shop?.hasGambit ?? true;
  const counterReachable = counter <= priorMax;
  const reachable = waveHasGambit && counterReachable;

  // Only compute picks for reachable cells — unreachable cells have
  // no meaningful gambit data to show, and skipping the wasm call
  // keeps the grid cheap to render.
  const prediction = useMemo(
    () => (reachable ? predictGachaponAt(seed, wave, counter, excludedBytes) : null),
    [reachable, seed, wave, counter, excludedBytes],
  );

  const cellPicks: (Gambit | null)[] = prediction?.picks ?? [];
  const hitGambit = cellPicks.find((g) => g !== null && targetIds.has(g.id)) ?? null;
  const isTargetHit = hitGambit !== null;

  const reason = !waveHasGambit
    ? "✕ no gachapon token in this wave's shop"
    : !counterReachable
      ? `✕ counter ${counter} unreachable — only ${priorMax} prior spins possible`
      : "✓ reachable at this wave / counter";

  const tooltipBody = shop ? (
    <div className="space-y-1.5">
      <div className="font-display text-[11px] uppercase tracking-wider text-[var(--color-wine)]">
        wave {wave} · counter {counter}
      </div>

      {/* Shop tokens — 3 slots. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
          shop tokens
        </div>
        <ul className="space-y-0.5 text-[11px]">
          {shop.slots.map((t, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="text-[var(--color-wine-dark)]/60">
                slot {i + 1}
              </span>
              <span
                className={`font-bold ${
                  t === "GAMBIT"
                    ? "text-[var(--color-wine)]"
                    : "text-[var(--color-wine-dark)]"
                }`}
              >
                {TOKEN_LABEL[t]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Predicted gambits, if reachable. */}
      {reachable && cellPicks.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
            gambit picks
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {cellPicks.map((g, i) =>
              g ? (
                <li
                  key={i}
                  className={`flex items-center gap-1.5 rounded-sm px-1 py-0.5 ${
                    targetIds.has(g.id)
                      ? "bg-[var(--color-yellow)] text-[var(--color-ink)]"
                      : ""
                  }`}
                >
                  {gambitSpriteUrl(g) && (
                    <img
                      src={gambitSpriteUrl(g)!}
                      alt={g.name}
                      className="pixel h-4 w-4 object-contain"
                      draggable={false}
                    />
                  )}
                  <span className="uppercase tracking-wider">
                    {gambitDisplayName(g)}
                  </span>
                </li>
              ) : (
                <li key={i} className="text-[var(--color-wine-dark)]/40">
                  —
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/50">
        prior spins possible: {priorMax}
      </div>
      <div
        className={`text-[10px] uppercase tracking-wider ${
          reachable
            ? "text-[var(--color-green-dark)]"
            : "text-[var(--color-wine)]"
        }`}
      >
        {reason}
      </div>
    </div>
  ) : null;

  // Border thickness stays 1px regardless of hit/no-hit so cell widths
  // line up perfectly across the grid; the hit highlight is a chunky
  // inset shadow + a bold roll digit instead.
  return (
    <td className="border border-[var(--color-cream-soft)] p-0">
      <CellTooltip content={tooltipBody} width={240}>
        <span
          className={`block w-full px-2 py-0.5 text-right text-[var(--color-ink)] ${TIER_BG[tier]} ${
            reachable ? "" : "opacity-30"
          } ${
            isTargetHit
              ? "font-bold shadow-[inset_0_0_0_2px_var(--color-ink),inset_0_0_0_4px_var(--color-yellow)]"
              : ""
          }`}
        >
          {roll.toString().padStart(2, " ")}
        </span>
      </CellTooltip>
    </td>
  );
}
