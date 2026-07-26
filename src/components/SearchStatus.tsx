interface SearchStatusProps {
  /** Worker is currently scanning a batch (between requestNext and paused). */
  fetching: boolean;
  /** Worker has hit the u32 seed-space ceiling - no more matches anywhere. */
  exhausted: boolean;
  /** Cumulative matches found across all batches so far. */
  matched: number;
  /** Sum of all batch targets requested so far (100, 200, …). */
  target: number;
  /** Cumulative seeds scanned so far. */
  scanned: number;
  /** Throughput in seeds-per-second for the current batch. */
  rate: number;
  onCancel: () => void;
}

/** Compact short-scale formatter - 8,129,179 → "8.1M", 4.3 B → "4.3B".
 *  Below 1k stays as-is. Intl handles locale-specific suffix mapping. */
const COMPACT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmt(n: number): string {
  return COMPACT.format(n);
}

function fmtRate(seedsPerSec: number): string {
  if (seedsPerSec >= 1e9) return `${(seedsPerSec / 1e9).toFixed(1)}B/s`;
  if (seedsPerSec >= 1e6) return `${(seedsPerSec / 1e6).toFixed(1)}M/s`;
  if (seedsPerSec >= 1e3) return `${(seedsPerSec / 1e3).toFixed(1)}K/s`;
  return `${seedsPerSec.toFixed(0)}/s`;
}

/**
 * Compact status card meant to sit in the centered 1/3-width action
 * strip below the filters. Renders as a single vertical card:
 *
 *   ┌─────────────────────────┐
 *   │  1.1K / 1.1K matches    │  ← big primary line
 *   │  ███████████████░░░░░░  │  ← progress bar
 *   │  8.1M scanned · 1.2M/s  │  ← compact secondary line
 *   │  scroll for more        │  ← state-driven hint
 *   └─────────────────────────┘
 */
export function SearchStatus({
  fetching,
  exhausted,
  matched,
  target,
  scanned,
  rate,
  onCancel,
}: SearchStatusProps) {
  const denom = target > 0 ? target : 1;
  const pct = Math.min(100, (matched / denom) * 100);

  const hint = exhausted
    ? matched === 0
      ? "no matches in any seed"
      : "scanned every seed - no more matches"
    : fetching
      ? "scanning for more…"
      : matched < target
        ? "halted - refine filters or scroll to retry"
        : "scroll the results to load more";

  const barColor = exhausted
    ? "bg-[var(--color-wine-light)]"
    : fetching
      ? "bg-[var(--color-green)]"
      : matched >= target && target > 0
        ? "bg-[var(--color-green-dark)]"
        : "bg-[var(--color-wine-light)]";

  return (
    <div className="inset-row space-y-2 text-[var(--color-wine-dark)]">
      <div className="flex items-baseline justify-between gap-2 font-mono">
        <span>
          <span className="text-base text-[var(--color-wine)]">
            {fmt(matched)}
          </span>
          <span className="text-sm text-[var(--color-wine-dark)]/60">
            {" / "}
            {fmt(target)}
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
          matches
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-sm border-2 border-[var(--color-ink)] bg-[var(--color-cream-soft)]">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-wine-dark)]/70">
        <span>{fmt(scanned)} scanned</span>
        {fetching && rate > 0 && <span>{fmtRate(rate)}</span>}
        {fetching && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[var(--color-wine)] underline-offset-2 hover:underline"
          >
            cancel
          </button>
        )}
      </div>

      <div className="text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/80">
        {hint}
      </div>
    </div>
  );
}
