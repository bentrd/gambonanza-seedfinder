import { useEffect, useMemo, useRef, useState } from "react";
import {
  gachaponRoll,
  gambitDisplayName,
  gambitSpriteUrl,
  predictGachapon,
  rarityTier,
  simulateStarters,
} from "../rng";
import { TIER_BG } from "../rng/rarityColors";
import { encodeExcludedIds } from "../search/encode";
import type { GachaponFilter, GambitFilter } from "../search/types";
import { GambitTooltip } from "./GambitTooltip";
import { PieceIcon } from "./PieceIcon";
import { CopyButton } from "./ui/CopyButton";
import { RarityBadge } from "./ui/RarityBadge";

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

function GambitPredictions({
  seed,
  maxGachapons,
  targetIds,
  excludedBytes,
}: {
  seed: number;
  maxGachapons: number;
  targetIds: Set<string>;
  excludedBytes: Uint32Array;
}) {
  const preds = Array.from({ length: maxGachapons }, (_, i) =>
    predictGachapon(seed, i, excludedBytes),
  );
  const poolLabel =
    excludedBytes.length > 0
      ? `pool excludes ${excludedBytes.length} gambit${excludedBytes.length === 1 ? "" : "s"}`
      : "fresh-run pool";
  return (
    <div>
      <div className="mb-1 font-display text-xs uppercase tracking-wider">
        Gachapon offerings (first {maxGachapons}, {poolLabel})
      </div>
      <div className="space-y-1.5">
        {preds.map((p) => (
          <div
            key={p.gachIdx}
            className="flex items-center gap-2 rounded-md bg-[var(--color-cream-soft)]/40 px-2 py-1.5"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70">
              #{p.gachIdx + 1}
            </span>
            <RarityBadge rarity={p.rarity} size="sm" font="mono" className="gap-1">
              <span className="uppercase">{p.rarity.slice(0, 3)}</span>
              <span>{p.rarityRoll.toString().padStart(2, " ")}</span>
            </RarityBadge>
            <div className="flex flex-1 items-center gap-1.5">
              {p.picks.map((g, i) => {
                if (!g) {
                  return (
                    <span
                      key={i}
                      className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/40"
                    >
                      —
                    </span>
                  );
                }
                const sprite = gambitSpriteUrl(g);
                const hit = targetIds.has(g.id);
                return (
                  <GambitTooltip key={i} gambit={g}>
                    <span
                      tabIndex={0}
                      className={`inline-flex cursor-help items-center gap-1 rounded-md border-2 px-1.5 py-0.5 ${
                        hit
                          ? "border-[var(--color-ink)] bg-[var(--color-yellow)] text-[var(--color-ink)] shadow-[0_2px_0_0_var(--color-ink)]"
                          : "border-[var(--color-cream-soft)] bg-[var(--color-cream-light)] text-[var(--color-wine-dark)]"
                      }`}
                    >
                      {sprite && (
                        <img
                          src={sprite}
                          alt={g.name}
                          className="pixel block h-5 w-5 object-contain"
                          draggable={false}
                        />
                      )}
                      <span className="text-[10px] uppercase tracking-wider">
                        {gambitDisplayName(g)}
                      </span>
                    </span>
                  </GambitTooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
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

      <GambitPredictions
        seed={seed}
        maxGachapons={Math.max(5, gambitFilter.maxGachapons)}
        targetIds={new Set(gambitFilter.targets)}
        excludedBytes={excludedBytes}
      />

      <div>
        <div className="mb-1 font-display text-xs uppercase tracking-wider">
          Gachapon roll grid (rows = counter, cols = wave)
        </div>
        <table className="font-mono text-[11px]">
          <thead>
            <tr className="text-[var(--color-wine-dark)]/70">
              <th className="px-2 text-right">c\w</th>
              {waves.map((w) => (
                <th key={w} className="px-2 text-right">
                  {w}
                </th>
              ))}
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
                  return (
                    <td
                      key={w}
                      className={`border border-[var(--color-cream-soft)] px-2 text-right text-[var(--color-ink)] ${TIER_BG[tier]}`}
                    >
                      {roll.toString().padStart(2, " ")}
                    </td>
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
