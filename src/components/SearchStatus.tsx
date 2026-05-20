import { IconButton } from "./ui/IconButton";

interface SearchStatusProps {
  /** Worker is currently scanning a batch (between requestNext and paused). */
  fetching: boolean;
  /** Worker has hit the u32 seed-space ceiling — no more matches anywhere. */
  exhausted: boolean;
  /** Cumulative matches found across all batches so far. */
  matched: number;
  /** Sum of all batch targets requested so far (100, 200, …). */
  target: number;
  /** Cumulative seeds scanned so far. */
  scanned: number;
  /** Throughput in seeds-per-second for the current batch (zero between batches). */
  rate: number;
  onCancel: () => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatRate(seedsPerSec: number): string {
  if (seedsPerSec >= 1e6) return `${(seedsPerSec / 1e6).toFixed(1)}M/s`;
  if (seedsPerSec >= 1e3) return `${(seedsPerSec / 1e3).toFixed(1)}K/s`;
  return `${seedsPerSec.toFixed(0)}/s`;
}

export function SearchStatus({
  fetching,
  exhausted,
  matched,
  target,
  scanned,
  rate,
  onCancel,
}: SearchStatusProps) {
  // Target can be 0 before the first search — show a neutral state.
  const denom = target > 0 ? target : 1;
  const pct = Math.min(100, (matched / denom) * 100);

  const subtext = exhausted
    ? matched === 0
      ? "no matches anywhere in the seed space"
      : "scanned every seed — no more matches"
    : fetching
      ? `${formatRate(rate)} · scrolled to bottom for more`
      : matched < target
        ? "halted — refine filters or try again"
        : "scroll the results to load more";

  return (
    <div className="inset-row text-[var(--color-wine-dark)]">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider">
        <span className="font-mono normal-case">
          <span className="text-[var(--color-wine)]">
            {formatNumber(matched)}
          </span>
          {" / "}
          {formatNumber(target)}
          {" matches"}
        </span>
        <span className="font-mono text-[var(--color-wine-dark)]/70 normal-case">
          {formatNumber(scanned)} scanned
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-sm border-2 border-[var(--color-ink)] bg-[var(--color-cream-soft)]">
        <div
          className={`h-full transition-all ${
            exhausted
              ? "bg-[var(--color-wine-light)]"
              : fetching
                ? "bg-[var(--color-green)]"
                : matched >= target && target > 0
                  ? "bg-[var(--color-green-dark)]"
                  : "bg-[var(--color-wine-light)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[var(--color-wine-dark)]/80">{subtext}</span>
        {fetching && (
          <IconButton onClick={onCancel} size="md">
            cancel
          </IconButton>
        )}
      </div>
    </div>
  );
}
