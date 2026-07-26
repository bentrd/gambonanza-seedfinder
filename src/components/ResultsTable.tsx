import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  gachaponRoll,
  gambitDisplayName,
  gambitSpriteUrl,
  predictGachaponAt,
  predictShopTokens,
  rarityTier,
  simulateStarters,
} from "../rng";
import type { Gambit, Rarity, ShopTokens, TokenType } from "../rng";
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
  /** No more seeds left to scan - sentinel becomes terminal. */
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
  //
  // Two render paths: a compact `<table>` for `sm+` (the dense desktop
  // layout) and a vertical card list for narrower viewports (each result
  // becomes its own card, no horizontal scroll). They share `ResultRow`
  // sub-components - the wrapper element changes, not the cell contents.
  return (
    <>
      {/* Mobile: stacked card list. */}
      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 sm:hidden">
        {seeds.map((seed, idx) => (
          <ResultCard
            key={seed}
            seed={seed}
            gachaponFilters={gachaponFilters}
            gambitFilter={gambitFilter}
            excludedBytes={excludedBytes}
            striped={idx % 2 === 1}
          />
        ))}
        <SentinelBlock
          fetching={fetching}
          exhausted={exhausted}
          hasResults={seeds.length > 0}
          onLoadMore={onLoadMore}
        />
      </div>

      {/* Desktop: dense table. */}
      <div className="hidden overflow-hidden rounded-lg border-2 border-[var(--color-ink)] sm:block">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-sm text-[var(--color-wine-dark)]">
            <thead className="sticky top-0 z-10 bg-[var(--color-wine)] text-[11px] uppercase tracking-wider text-[var(--color-cream)] shadow-[0_2px_0_0_var(--color-ink)]">
              <tr>
                <th className="w-28 px-3 py-2 text-left">Seed</th>
                <th className="w-28 px-3 py-2 text-left">Starters</th>
                <th className="w-64 px-3 py-2 text-left">
                  <span className="block font-display lowercase">
                    trajectory
                  </span>
                  <span className="block font-mono text-[10px] normal-case opacity-80">
                    first 5 spins
                  </span>
                </th>
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
                <th className="w-12"></th>
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
                colSpan={gachaponFilters.length + 4}
                fetching={fetching}
                exhausted={exhausted}
                hasResults={seeds.length > 0}
                onLoadMore={onLoadMore}
              />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

interface ResultCardProps {
  seed: number;
  gachaponFilters: GachaponFilter[];
  gambitFilter: GambitFilter;
  excludedBytes: Uint32Array;
  striped: boolean;
}

/**
 * Mobile-only card variant of `ResultRow`. Shows the same data as the
 * desktop table but stacked vertically so nothing overflows a 360px
 * viewport. The expanded state reuses the same `Inspector` as the table.
 */
function ResultCard({
  seed,
  gachaponFilters,
  gambitFilter,
  excludedBytes,
  striped,
}: ResultCardProps) {
  const [open, setOpen] = useState(false);
  const starters = simulateStarters(seed);
  const rolls = gachaponFilters.map((g) => gachaponRoll(seed, g.wave, g.counter));

  return (
    <div
      className={`overflow-hidden rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-cream)] ${
        striped ? "bg-[var(--color-cream-light)]/70" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full cursor-pointer text-left"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <span className="font-mono text-[var(--color-wine)]">{seed}</span>
          <span className="inline-flex items-end gap-1">
            {starters.map((s, i) => (
              <PieceIcon key={i} piece={s.piece} variant="w" size={22} />
            ))}
          </span>
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center text-base font-bold text-[var(--color-wine)]"
          >
            {open ? "−" : "+"}
          </span>
        </div>
        <div className="px-3 pb-2 pt-1">
          <div className="flex flex-wrap items-center gap-1">
            <TrajectoryPreview seed={seed} count={5} />
          </div>
        </div>
        {rolls.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
            {rolls.map((roll, i) => {
              const tier = rarityTier(roll);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-cream-soft)]/40 px-2 py-1"
                >
                  <span className="font-display text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/70">
                    gach #{i + 1}
                  </span>
                  <RarityBadge rarity={tier} size="md" font="mono" className="gap-1">
                    <span className="uppercase">{tier.slice(0, 3)}</span>
                    <span>{roll.toString().padStart(2, " ")}</span>
                  </RarityBadge>
                </div>
              );
            })}
          </div>
        )}
      </button>
      {open && (
        <div className="border-t-2 border-[var(--color-cream-soft)] bg-[var(--color-cream-light)] px-3 py-3">
          <Inspector
            seed={seed}
            gachaponFilters={gachaponFilters}
            gambitFilter={gambitFilter}
            excludedBytes={excludedBytes}
          />
        </div>
      )}
    </div>
  );
}

interface SentinelBlockProps {
  fetching: boolean;
  exhausted: boolean;
  hasResults: boolean;
  onLoadMore: () => void;
}

/**
 * Mobile-card-list equivalent of `SentinelRow`. Same IntersectionObserver
 * logic, rendered as a `<div>` block instead of a `<tr>` so it can live
 * outside a `<table>`.
 */
function SentinelBlock({
  fetching,
  exhausted,
  hasResults,
  onLoadMore,
}: SentinelBlockProps) {
  const ref = useRef<HTMLDivElement | null>(null);
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
      ? "scanned every seed - no more matches"
      : "no matches anywhere in the seed space"
    : fetching
      ? "scanning for more matches…"
      : hasResults
        ? "scroll for more"
        : "halted - refine filters or scroll to retry";

  return (
    <div
      ref={ref}
      className={`rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 py-3 text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70 ${
        fetching ? "animate-pulse" : ""
      }`}
    >
      {label}
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
        <td className="px-3 py-2">
          <TrajectoryPreview seed={seed} count={5} />
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
        <td className="px-2 py-2 text-center align-middle">
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center text-sm font-bold text-[var(--color-wine)]"
          >
            {open ? "−" : "+"}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-t-2 border-[var(--color-cream-soft)] bg-[var(--color-cream-light)]">
          <td colSpan={gachaponFilters.length + 4} className="max-w-0 px-3 py-3">
            <Inspector
              seed={seed}
              gachaponFilters={gachaponFilters}
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
  gachaponFilters,
  gambitFilter,
  excludedBytes,
}: {
  seed: number;
  gachaponFilters: GachaponFilter[];
  gambitFilter: GambitFilter;
  excludedBytes: Uint32Array;
}) {
  const starters = simulateStarters(seed);
  const hasGambitFilter = gambitFilter.targets.length > 0;
  const maxGambitSpins = hasGambitFilter
    ? Math.max(1, Math.min(32, gambitFilter.maxGachapons | 0))
    : 5;
  const explicitMaxWave = Math.max(0, ...gachaponFilters.map((g) => g.wave));
  const explicitMaxCounter = Math.max(0, ...gachaponFilters.map((g) => g.counter));
  const gambitTrajectoryWave = useMemo(
    () => (hasGambitFilter ? lastWaveForGambitSpins(seed, maxGambitSpins) : 8),
    [hasGambitFilter, maxGambitSpins, seed],
  );
  const waveCount = Math.max(8, explicitMaxWave, gambitTrajectoryWave);
  const counterCount = Math.max(
    5,
    explicitMaxCounter + 1,
    hasGambitFilter ? maxGambitSpins : 0,
  );
  const waves = useMemo(
    () => Array.from({ length: waveCount }, (_, i) => i + 1),
    [waveCount],
  );
  const counters = useMemo(
    () => Array.from({ length: counterCount }, (_, i) => i),
    [counterCount],
  );
  const shopTokens = useMemo(
    () => predictShopTokens(seed, waveCount),
    [seed, waveCount],
  );
  const targetIds = useMemo(
    () => new Set(gambitFilter.targets),
    [gambitFilter.targets],
  );
  const comboHighlights = useMemo(
    () =>
      gambitFilter.matchMode === "all"
        ? buildComboHighlights(
            seed,
            gambitFilter.targets,
            gambitFilter.maxGachapons,
            excludedBytes,
          )
        : new Map<string, string>(),
    [
      excludedBytes,
      gambitFilter.matchMode,
      gambitFilter.maxGachapons,
      gambitFilter.targets,
      seed,
    ],
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

      {/* Two-column layout: starter rolls stack vertically on the left,
          the gachapon roll grid takes the bulk of the width on the
          right. `items-stretch` + `flex-1` on each piece card makes
          the starter column match the grid's height - pieces share
          the vertical space evenly. Stacks on small screens. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
        <div className="flex flex-col gap-2 md:w-56">
          <div className="font-display text-xs uppercase tracking-wider">
            Starter rolls
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {starters.map((s, i) => (
              <div
                key={i}
                className="flex flex-1 items-center gap-3 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 py-2 font-mono text-xs"
              >
                <PieceIcon piece={s.piece} variant="w" size={36} />
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
                    slot {i + 1}
                  </span>
                  <span className="font-display text-sm uppercase text-[var(--color-wine)]">
                    {s.piece}
                  </span>
                  <span className="text-[10px] text-[var(--color-wine-dark)]/60">
                    lo={s.lo} num={s.num.toString().padStart(2, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <RollGrid
            seed={seed}
            waves={waves}
            counters={counters}
            shopTokens={shopTokens}
            priorGambits={priorGambits}
            excludedBytes={excludedBytes}
            targetIds={targetIds}
            matchMode={gambitFilter.matchMode}
            comboHighlights={comboHighlights}
          />
        </div>
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
 * Bottom row of the results table - drives the "infinite scroll"
 * pagination. An IntersectionObserver watches the row; when it scrolls
 * into view AND we're idle (not fetching) AND there's more seed space
 * to scan, it requests the next batch.
 *
 * Also acts as the status line at the bottom of the table:
 *   - fetching   → "scanning for more…" with a subtle pulse
 *   - exhausted  → "no more matches in the seed space"
 *   - empty + ¬exhausted → "halted - refine filters or scroll to retry"
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
      ? "scanned every seed - no more matches"
      : "no matches anywhere in the seed space"
    : fetching
      ? "scanning for more matches…"
      : hasResults
        ? "scroll for more"
        : "halted - refine filters or scroll to retry";

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

function lastWaveForGambitSpins(seed: number, maxSpins: number): number {
  const target = Math.max(1, Math.min(32, maxSpins | 0));
  const shops = predictShopTokens(seed, 32);
  let spins = 0;
  for (const shop of shops) {
    spins += shop.gambitCount;
    if (spins >= target) return shop.wave;
  }
  return 32;
}

function buildComboHighlights(
  seed: number,
  targetIds: readonly string[],
  maxGachapons: number,
  excludedBytes: Uint32Array,
): Map<string, string> {
  const targets = Array.from(new Set(targetIds));
  if (targets.length === 0) return new Map();

  const targetSet = new Set(targets);
  const shops = predictShopTokens(seed, 32);
  const spinOptions: { key: string; ids: string[] }[] = [];
  const maxSpins = Math.max(1, Math.min(32, maxGachapons | 0));
  let spin = 0;

  for (const shop of shops) {
    for (let i = 0; i < shop.gambitCount; i++) {
      if (spin >= maxSpins) break;
      const pick = predictGachaponAt(seed, shop.wave, spin, excludedBytes);
      const ids = Array.from(
        new Set(
          pick.picks
            .filter((g): g is Gambit => g !== null && targetSet.has(g.id))
            .map((g) => g.id),
        ),
      );
      spinOptions.push({ key: `${shop.wave}:${spin}`, ids });
      spin++;
    }
    if (spin >= maxSpins) break;
  }

  const spinMatch = new Array<number>(spinOptions.length).fill(-1);
  const augment = (targetIdx: number, seen: Set<number>): boolean => {
    const target = targets[targetIdx];
    for (let spinIdx = 0; spinIdx < spinOptions.length; spinIdx++) {
      if (seen.has(spinIdx) || !spinOptions[spinIdx].ids.includes(target)) {
        continue;
      }
      seen.add(spinIdx);
      const current = spinMatch[spinIdx];
      if (current === -1 || augment(current, seen)) {
        spinMatch[spinIdx] = targetIdx;
        return true;
      }
    }
    return false;
  };

  for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
    if (!augment(targetIdx, new Set())) return new Map();
  }

  const out = new Map<string, string>();
  for (let spinIdx = 0; spinIdx < spinMatch.length; spinIdx++) {
    const targetIdx = spinMatch[spinIdx];
    if (targetIdx !== -1) out.set(spinOptions[spinIdx].key, targets[targetIdx]);
  }
  return out;
}

/**
 * Inline trajectory preview rendered in each result row. Shows the
 * first `count` reachable gachapon spins as tier-coloured roll chips
 * - gives the user a quick visual quality scan without expanding the
 * row. Empty placeholder slots fill the column when the trajectory
 * has fewer than `count` spins.
 */
function TrajectoryPreview({
  seed,
  count = 5,
}: {
  seed: number;
  count?: number;
}) {
  const shopTokens = useMemo(() => predictShopTokens(seed, 16), [seed]);
  const spins = useMemo(() => {
    const out: { shop: number; counter: number; tier: Rarity; roll: number }[] = [];
    let counter = 0;
    for (const shop of shopTokens) {
      for (let i = 0; i < shop.gambitCount; i++) {
        const roll = gachaponRoll(seed, shop.wave, counter);
        out.push({
          shop: shop.wave,
          counter,
          tier: rarityTier(roll),
          roll,
        });
        counter++;
        if (out.length >= count) break;
      }
      if (out.length >= count) break;
    }
    return out;
  }, [seed, shopTokens, count]);

  return (
    <div className="inline-flex items-center gap-1">
      {spins.map((s) => (
        <CellTooltip
          key={s.counter}
          width={180}
          content={
            <div className="space-y-0.5">
              <div className="font-display text-[11px] uppercase tracking-wider text-[var(--color-wine)]">
                spin #{s.counter + 1}
              </div>
              <div className="text-[10px] text-[var(--color-wine-dark)]/70">
                shop {s.shop} · roll {s.roll} · {s.tier.toLowerCase()}
              </div>
            </div>
          }
        >
          <RarityBadge
            rarity={s.tier}
            size="track"
            font="mono"
            className="cursor-help"
          >
            {s.roll}
          </RarityBadge>
        </CellTooltip>
      ))}
      {Array.from({ length: Math.max(0, count - spins.length) }).map((_, i) => (
        <span
          key={`empty-${i}`}
          className="inline-flex h-5 w-9 items-center justify-center rounded-md border-2 border-[var(--color-cream-soft)] font-mono text-[10px] text-[var(--color-wine-dark)]/30"
          title="no spin reachable"
        >
          -
        </span>
      ))}
    </div>
  );
}

/**
 * Gachapon roll-grid display - rebuilt as a CSS Grid so every cell is
 * guaranteed to be the same size (the old `<table>` auto-sized columns
 * to their text content, which made "100" wider than "4").
 *
 * Layout: a header row (shop indices 1..N) followed by `counters.length`
 * rows of `RollCell`s. The first column is a "spin #" label.
 *
 * Visual hierarchy:
 *  - **Shop number header** is faded for shops with no GAMBIT token.
 *  - **Unreachable cells** (wave has no GAMBIT, or counter exceeds the
 *    prior spin budget) are dimmed to opacity-30 with neutral tint.
 *  - **Trajectory cells** - the actual `(shop, counter)` pairs the
 *    player reaches under spin-every - get a chunky outer ring so the
 *    user can read off "this is what would actually happen".
 *  - **Target hits** - trajectory cells whose picks include one of the
 *    user's selected gambits - get an extra yellow inset accent.
 */
interface RollGridProps {
  seed: number;
  waves: readonly number[];
  counters: readonly number[];
  shopTokens: readonly ShopTokens[];
  priorGambits: readonly number[];
  excludedBytes: Uint32Array;
  targetIds: Set<string>;
  matchMode: GambitFilter["matchMode"];
  comboHighlights: Map<string, string>;
}

function RollGrid({
  seed,
  waves,
  counters,
  shopTokens,
  priorGambits,
  excludedBytes,
  targetIds,
  matchMode,
  comboHighlights,
}: RollGridProps) {
  // Build the set of trajectory cells `"shop:counter"` for spin-every.
  // Counter advances per GAMBIT slot, so a shop with 2 GAMBITs
  // contributes two consecutive counters at the same shop.
  const trajectory = useMemo(() => {
    const set = new Set<string>();
    let counter = 0;
    for (const shop of shopTokens) {
      for (let i = 0; i < shop.gambitCount; i++) {
        set.add(`${shop.wave}:${counter}`);
        counter++;
      }
    }
    return set;
  }, [shopTokens]);

  // grid-template-columns: a narrow label column + one equal-width
  // track per shop. Using `grid` rather than `<table>` so cell widths
  // come from the template, not from content. `flex flex-col h-full`
  // on the wrapper + `flex-1` + auto-rows-fr on the grid itself makes
  // the grid stretch to fill the parent column's height (so it visually
  // matches the starter-pieces column when both sit in an items-stretch
  // flex row).
  const cols = waves.length;
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline gap-3 font-display text-xs uppercase tracking-wider">
        <span>Gachapon rolls</span>
        <span className="text-[10px] normal-case text-[var(--color-wine-dark)]/60">
          rows = spin counter · cols = shop · scroll sideways for later shops
        </span>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-md pb-2">
        <div
          className="grid w-max min-w-full gap-1 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream-light)] p-1.5 text-[10px] sm:gap-1.5 sm:p-2 sm:text-[11px]"
          style={{
            // Keep cells readable as the relevant window grows. The
            // wrapper scrolls horizontally instead of squashing 20–32
            // shop columns into unreadable slivers.
            gridTemplateColumns: `2.25rem repeat(${cols}, minmax(2.75rem, 3rem))`,
            gridAutoRows: "minmax(1.75rem, auto)",
          }}
        >
          {/* Header row */}
        <div className="px-1 pb-1 text-center font-display text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
          shop
        </div>
        {waves.map((w) => {
          const shop = shopTokens[w - 1];
          const hasGambit = shop?.hasGambit ?? false;
          return (
            <div
              key={w}
              className={`pb-1 text-center font-display text-[12px] uppercase tracking-wider ${
                hasGambit
                  ? "text-[var(--color-wine)]"
                  : "text-[var(--color-wine-dark)]/30"
              }`}
              title={
                hasGambit
                  ? `shop ${w}: gachapon token offered`
                  : `shop ${w}: no gachapon token - unreachable`
              }
            >
              {w}
            </div>
          );
        })}

        {/* Body rows - one per counter value */}
          {counters.map((c) => (
            <Fragment key={c}>
              <div className="flex items-center justify-center font-display text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
                #{c}
              </div>
              {waves.map((w) => {
                const roll = gachaponRoll(seed, w, c);
                const tier = rarityTier(roll);
                const shop = shopTokens[w - 1];
                const priorMax = priorGambits[w - 1] ?? 0;
                const onTrajectory = trajectory.has(`${w}:${c}`);
                return (
                  <RollCell
                    key={`${w}-${c}`}
                    seed={seed}
                    wave={w}
                    counter={c}
                    roll={roll}
                    tier={tier}
                    shop={shop}
                    priorMax={priorMax}
                    excludedBytes={excludedBytes}
                    targetIds={targetIds}
                    matchMode={matchMode}
                    comboTargetId={comboHighlights.get(`${w}:${c}`) ?? null}
                    onTrajectory={onTrajectory}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  /** Filter exclusion bytes - passed through to `predictGachaponAt`
   *  so the cell's picks reflect the user's locked pool. */
  excludedBytes: Uint32Array;
  /** Gambit IDs the user is searching for. Cells whose picks include
   *  any of these get a yellow highlight in ANY mode. */
  targetIds: Set<string>;
  matchMode: GambitFilter["matchMode"];
  /** In ALL mode, the single target assigned to this gachapon by the
   *  one-pick-per-spin combo matcher. Other selected picks in the same
   *  offer are alternatives, not additional combo progress. */
  comboTargetId: string | null;
  /** True if `(wave, counter)` is the player's natural spin position
   *  under the spin-every-GAMBIT trajectory. Cells on the trajectory
   *  get a chunkier border so the user sees the actual play path. */
  onTrajectory: boolean;
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
  matchMode,
  comboTargetId,
  onTrajectory,
}: RollCellProps) {
  const waveHasGambit = shop?.hasGambit ?? true;
  const counterReachable = counter <= priorMax;
  const reachable = waveHasGambit && counterReachable;

  // Only compute picks for reachable cells - unreachable cells have
  // no meaningful gambit data to show, and skipping the wasm call
  // keeps the grid cheap to render.
  const prediction = useMemo(
    () => (reachable ? predictGachaponAt(seed, wave, counter, excludedBytes) : null),
    [reachable, seed, wave, counter, excludedBytes],
  );

  const cellPicks: (Gambit | null)[] = prediction?.picks ?? [];
  const hitGambit =
    matchMode === "all"
      ? cellPicks.find((g) => g !== null && g.id === comboTargetId) ?? null
      : cellPicks.find((g) => g !== null && targetIds.has(g.id)) ?? null;
  const isTargetHit = hitGambit !== null;
  const isHighlightedPick = (g: Gambit): boolean =>
    matchMode === "all" ? g.id === comboTargetId : targetIds.has(g.id);

  const reason = !waveHasGambit
    ? "✕ no gachapon token in this wave's shop"
    : !counterReachable
      ? `✕ counter ${counter} unreachable - only ${priorMax} prior spins possible`
      : "✓ reachable at this wave / counter";

  const tooltipBody = shop ? (
    <div className="space-y-1.5">
      <div className="font-display text-[11px] uppercase tracking-wider text-[var(--color-wine)]">
        wave {wave} · counter {counter}
      </div>

      {/* Shop tokens - 3 slots. */}
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
                    isHighlightedPick(g)
                      ? "bg-[var(--color-yellow)] text-[var(--color-ink)]"
                      : targetIds.has(g.id)
                        ? "bg-[var(--color-cream-soft)]/60"
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
                  -
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

  // Cell is a fixed-size div in the parent CSS Grid. All cells use a
  // 1px border so widths align exactly; visual difference comes from
  // box-shadow / background only.
  //
  //   base       - tier-tinted background (faded if unreachable)
  //   trajectory - subtle 1px wine inset shadow ("the player would
  //                reach this cell"). No outer border change so the
  //                cell can't be confused with a hit.
  //   hit        - chunky 2px ink ring + 2px drop shadow + bold. No
  //                inset tint: the cell stays its own tier colour so
  //                the highlight reads as "stand out" without falsely
  //                implying legendary (yellow) or any other rarity.
  //                ONLY applies to cells whose 3 picks include a
  //                target gambit; cell rarity must match a target's.
  const boxShadow = isTargetHit
    ? "0 0 0 2px var(--color-ink), 0 2px 0 2px var(--color-ink)"
    : onTrajectory && reachable
      ? "inset 0 0 0 1px var(--color-wine)"
      : "none";

  return (
    <CellTooltip
      content={tooltipBody}
      width={240}
      triggerClassName="block h-full"
    >
      <div
        className={`flex h-full min-h-[1.75rem] w-full items-center justify-center rounded-sm font-mono tabular-nums text-[var(--color-ink)] ${TIER_BG[tier]} ${
          reachable ? "" : "bg-[var(--color-cream-soft)]/40 opacity-40"
        } ${isTargetHit ? "font-bold" : ""}`}
        style={{ boxShadow }}
      >
        {roll}
      </div>
    </CellTooltip>
  );
}
