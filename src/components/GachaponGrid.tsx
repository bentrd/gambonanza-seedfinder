import { useState } from "react";
import type { Rarity } from "../rng";
import { RARITIES } from "../rng";
import { TIER_BANDS } from "../rng/rarityColors";
import type { GachaponFilter } from "../search/types";
import { defaultGachapon } from "../search/encode";
import { ChipButton } from "./ui/Chip";
import { IconButton } from "./ui/IconButton";
import { InfoTooltip } from "./ui/InfoTooltip";
import { RarityBadge } from "./ui/RarityBadge";
import { SectionHeader } from "./ui/SectionHeader";
import { Stepper } from "./ui/Stepper";
import { TrashIcon } from "./ui/TrashIcon";

interface GachaponGridProps {
  value: GachaponFilter[];
  onChange: (next: GachaponFilter[]) => void;
}

const TIER_OPTIONS: ReadonlyArray<{ value: Rarity | "ANY"; label: string }> = [
  { value: "ANY", label: "any" },
  ...RARITIES.map((r) => ({ value: r, label: r.toLowerCase() })),
];

export function GachaponGrid({ value, onChange }: GachaponGridProps) {
  const update = (idx: number, patch: Partial<GachaponFilter>) => {
    const next = value.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    onChange(next);
  };

  const addRow = () => {
    if (value.length >= 10) return;
    onChange([...value, defaultGachapon(value.length)]);
  };

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    // Match the picker's layout pattern: flex-col h-full so the rows
    // area can `flex-1 min-h-0 overflow-y-auto` when the user adds more
    // rows than fit in the locked filter row height.
    <section className="flex h-full flex-col gap-3">
      <SectionHeader
        title="Gachapon rarities"
        action={
          <ChipButton onClick={addRow} disabled={value.length >= 10}>
            + add row
          </ChipButton>
        }
      />

      {value.length === 0 ? (
        <p className="rounded-md bg-[var(--color-cream-soft)]/50 px-3 py-3 text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70">
          No gachapon constraints. Searching by starter pieces only.
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-3">
          {value.map((g, i) => (
            <GachaponRow
              key={i}
              index={i}
              filter={g}
              onChange={(patch) => update(i, patch)}
              onRemove={() => removeRow(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface GachaponRowProps {
  index: number;
  filter: GachaponFilter;
  onChange: (patch: Partial<GachaponFilter>) => void;
  onRemove: () => void;
}

function GachaponRow({ index, filter, onChange, onRemove }: GachaponRowProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isAny = filter.tierMin === "COMMON" && filter.tierMax === "LEGENDARY";
  const setTier = (selected: Rarity | "ANY") => {
    const [rollMin, rollMax] = TIER_BANDS[selected];
    if (selected === "ANY") {
      onChange({ tierMin: "COMMON", tierMax: "LEGENDARY", rollMin, rollMax });
    } else {
      onChange({ tierMin: selected, tierMax: selected, rollMin, rollMax });
    }
  };
  const currentTier: Rarity | "ANY" = isAny ? "ANY" : filter.tierMin;
  const [tierFloor, tierCeil] = TIER_BANDS[currentTier];

  return (
    <div className="inset-row relative space-y-2 pr-10">
      <IconButton
        onClick={onRemove}
        title="remove"
        aria-label="remove gachapon row"
        className="absolute right-2 top-2"
      >
        <TrashIcon />
      </IconButton>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm uppercase tracking-wider">
          #{index + 1}
        </span>
        <div className="flex flex-wrap gap-1">
          {TIER_OPTIONS.map((o) => (
            <RarityBadge
              key={o.value}
              rarity={o.value}
              active={o.value === currentTier}
              onClick={() => setTier(o.value)}
            >
              {o.label}
            </RarityBadge>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        aria-expanded={advancedOpen}
        className="flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/70 hover:text-[var(--color-wine)]"
      >
        <span
          className={`inline-block transition-transform ${
            advancedOpen ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
        advanced
      </button>

      {advancedOpen && (
        <div className="border-t border-[var(--color-wine-dark)]/15 pt-3">
          <div className="grid grid-cols-[68px_1fr_auto] items-center gap-x-3 gap-y-2">
            <span className="font-display text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/80">
              wave
            </span>
            <Stepper
              value={filter.wave}
              min={0}
              max={50}
              onChange={(wave) => onChange({ wave })}
            />
            <InfoTooltip>
              The run wave at the moment the gachapon is spun.
            </InfoTooltip>

            <span className="font-display text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/80">
              counter
            </span>
            <Stepper
              value={filter.counter}
              min={0}
              max={255}
              onChange={(counter) => onChange({ counter })}
            />
            <InfoTooltip>
              Per-run gachapon spin count, starting at 0. Only spinning a
              gachapon advances it: buying pieces, gambits or rerolls do
              not.
            </InfoTooltip>

            <span className="font-display text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/80">
              roll
            </span>
            <RollRange
              min={filter.rollMin}
              max={filter.rollMax}
              floor={tierFloor}
              ceil={tierCeil}
              onChange={(rollMin, rollMax) => onChange({ rollMin, rollMax })}
            />
            <InfoTooltip>
              The raw 0–100 RNG value. Picking a tier above snaps this to
              its band; narrow it here for a finer match (e.g. legendary
              95+). Bands: 0–39 common, 40–69 rare, 70–89 epic, 90–100
              legendary.
            </InfoTooltip>
          </div>
        </div>
      )}
    </div>
  );
}

interface RollRangeProps {
  min: number;
  max: number;
  floor: number;
  ceil: number;
  onChange: (min: number, max: number) => void;
}

function RollRange({ min, max, floor, ceil, onChange }: RollRangeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={min}
        min={floor}
        max={ceil}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(floor, n)), max);
        }}
        className="input-game w-12 flex-none text-center"
      />
      <span className="text-[var(--color-wine-dark)]/50">to</span>
      <input
        type="number"
        value={max}
        min={floor}
        max={ceil}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(min, Math.max(min, Math.min(ceil, n)));
        }}
        className="input-game w-12 flex-none text-center"
      />
    </div>
  );
}
