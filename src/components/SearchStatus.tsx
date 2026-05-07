import { IconButton } from "./ui/IconButton";

interface SearchStatusProps {
  active: boolean;
  scanned: number;
  matched: number;
  total: number;
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

function formatEta(remaining: number, rate: number): string {
  if (rate <= 0) return "...";
  const sec = remaining / rate;
  if (sec < 60) return `${sec.toFixed(0)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}min`;
  return `${(sec / 3600).toFixed(1)}h`;
}

export function SearchStatus({
  active,
  scanned,
  matched,
  total,
  rate,
  onCancel,
}: SearchStatusProps) {
  const pct = total > 0 ? (scanned / total) * 100 : 0;
  const remaining = Math.max(0, total - scanned);

  return (
    <div className="inset-row text-[var(--color-wine-dark)]">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider">
        <span className="font-mono normal-case">
          {formatNumber(scanned)} / {formatNumber(total)}
        </span>
        <span className="font-mono text-[var(--color-wine-dark)]/80 normal-case">
          {formatRate(rate)} · eta {formatEta(remaining, rate)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-sm border-2 border-[var(--color-ink)] bg-[var(--color-cream-soft)]">
        <div
          className={`h-full transition-all ${
            active ? "bg-[var(--color-green)]" : "bg-[var(--color-wine-light)]"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="uppercase tracking-wider">
          <span className="font-mono text-[var(--color-wine)] normal-case">
            {formatNumber(matched)}
          </span>{" "}
          matches
        </span>
        {active && (
          <IconButton onClick={onCancel} size="md">
            cancel
          </IconButton>
        )}
      </div>
    </div>
  );
}
