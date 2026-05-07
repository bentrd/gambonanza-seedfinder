import { useState } from "react";
import { gachaponRoll, rarityTier, simulateStarters } from "../rng";
import { TIER_BG } from "../rng/rarityColors";
import type { GachaponFilter } from "../search/types";
import { PieceIcon } from "./PieceIcon";
import { CopyButton } from "./ui/CopyButton";

interface ResultsTableProps {
  seeds: number[];
  gachaponFilters: GachaponFilter[];
}

export function ResultsTable({ seeds, gachaponFilters }: ResultsTableProps) {
  if (seeds.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-[var(--color-cream-soft)]/40 text-sm uppercase tracking-wider text-[var(--color-wine-dark)]/70">
        Set your filters and hit Search.
      </div>
    );
  }

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
                striped={idx % 2 === 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ResultRowProps {
  seed: number;
  gachaponFilters: GachaponFilter[];
  striped: boolean;
}

function ResultRow({ seed, gachaponFilters, striped }: ResultRowProps) {
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
              <span
                className={`inline-flex items-center gap-1 rounded-md border-2 border-[var(--color-ink)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-ink)] ${TIER_BG[tier]}`}
              >
                <span className="uppercase">{tier.slice(0, 3)}</span>
                <span>{roll.toString().padStart(2, " ")}</span>
              </span>
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
            <Inspector seed={seed} />
          </td>
        </tr>
      )}
    </>
  );
}

function Inspector({ seed }: { seed: number }) {
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
