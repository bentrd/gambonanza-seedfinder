import { useMemo, useState } from "react";
import type { Gambit, Rarity } from "../rng";
import {
  gambitDescriptionPlain,
  gambitDisplayName,
  gambitSpriteUrl,
  getGambits,
} from "../rng";
import { TIER_BG } from "../rng/rarityColors";
import type { GambitFilter } from "../search/types";
import { GambitTooltip } from "./GambitTooltip";
import { ChipButton } from "./ui/Chip";
import { PixelToggle } from "./ui/PixelToggle";
import { SectionHeader } from "./ui/SectionHeader";
import { SettingsIcon } from "./ui/SettingsIcon";
import { Stepper } from "./ui/Stepper";

interface GambitPickerProps {
  value: GambitFilter;
  onChange: (next: GambitFilter) => void;
  onOpenUnlocks: () => void;
}

export function GambitPicker({
  value,
  onChange,
  onOpenUnlocks,
}: GambitPickerProps) {
  const all = useMemo(() => getGambits(), []);
  const [query, setQuery] = useState("");
  const lockedCount = value.excludedIds.length;

  const selectedSet = useMemo(() => new Set(value.targets), [value.targets]);

  // Filter by query — match name, display name, ID, focus tag, or description.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((g) => {
      const hay = [
        gambitDisplayName(g),
        gambitDescriptionPlain(g),
        g.name,
        g.id,
        ...g.focus,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [all, query]);

  const grouped = useMemo(() => {
    // Display order: rarest first.
    const order: Rarity[] = ["LEGENDARY", "EPIC", "RARE", "COMMON"];
    return order.map((r) => ({
      rarity: r,
      gambits: filtered.filter((g) => g.rarity === r),
    }));
  }, [filtered]);

  const toggle = (g: Gambit) => {
    const next = new Set(selectedSet);
    if (next.has(g.id)) next.delete(g.id);
    else next.add(g.id);
    onChange({ ...value, targets: Array.from(next) });
  };

  const clearAll = () => onChange({ ...value, targets: [] });

  const selectedCount = value.targets.length;

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Gambits"
        action={
          <div className="flex items-center gap-2">
            {selectedCount > 0 ? (
              <ChipButton onClick={clearAll}>
                clear ({selectedCount})
              </ChipButton>
            ) : (
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
                pick any to filter
              </span>
            )}
            <button
              type="button"
              onClick={onOpenUnlocks}
              title="My unlocked gambits"
              aria-label="configure unlocked gambits"
              className="chip-cream relative inline-flex cursor-pointer items-center justify-center px-2 py-1 text-[var(--color-wine-dark)] transition-transform hover:bg-[var(--color-wine)] hover:text-[var(--color-cream)] active:translate-y-0.5"
            >
              <SettingsIcon size={14} />
              {lockedCount > 0 && (
                <span className="ml-1 font-mono text-[10px]">
                  −{lockedCount}
                </span>
              )}
            </button>
          </div>
        }
      />

      <div className="space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search gambits, focus tags…"
          className="input-game w-full"
          aria-label="search gambits"
        />

        <div
          className={`flex items-center gap-2 rounded-md bg-[var(--color-cream-soft)]/40 px-3 py-2 text-[11px] uppercase tracking-wider transition-opacity ${
            selectedCount > 0
              ? "text-[var(--color-wine-dark)]"
              : "pointer-events-none text-[var(--color-wine-dark)]/40 opacity-60"
          }`}
          aria-disabled={selectedCount === 0}
        >
          <span>within first</span>
          <Stepper
            value={value.maxGachapons}
            min={1}
            max={32}
            onChange={(maxGachapons) => onChange({ ...value, maxGachapons })}
          />
          <span>gachapons</span>
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md bg-[var(--color-cream-soft)]/30 p-2">
          {grouped.every((g) => g.gambits.length === 0) ? (
            <p className="px-2 py-6 text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
              No gambits match “{query}”
            </p>
          ) : (
            grouped.map(({ rarity, gambits }) =>
              gambits.length === 0 ? null : (
                <RaritySection
                  key={rarity}
                  rarity={rarity}
                  gambits={gambits}
                  selectedSet={selectedSet}
                  onToggle={toggle}
                />
              ),
            )
          )}
        </div>
      </div>
    </section>
  );
}

interface RaritySectionProps {
  rarity: Rarity;
  gambits: readonly Gambit[];
  selectedSet: Set<string>;
  onToggle: (g: Gambit) => void;
}

function RaritySection({
  rarity,
  gambits,
  selectedSet,
  onToggle,
}: RaritySectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span
          className={`inline-block rounded-md border-2 border-[var(--color-ink)] px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-[var(--color-ink)] ${TIER_BG[rarity]}`}
        >
          {rarity.toLowerCase()}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
          {gambits.length}
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {gambits.map((g) => (
          <GambitToggle
            key={g.id}
            gambit={g}
            active={selectedSet.has(g.id)}
            onClick={() => onToggle(g)}
          />
        ))}
      </div>
    </div>
  );
}

interface GambitToggleProps {
  gambit: Gambit;
  active: boolean;
  onClick: () => void;
}

function GambitToggle({ gambit, active, onClick }: GambitToggleProps) {
  const sprite = gambitSpriteUrl(gambit);
  return (
    <GambitTooltip gambit={gambit}>
      <PixelToggle
        active={active}
        onClick={onClick}
        aria-label={`${gambitDisplayName(gambit)} (${gambit.rarity.toLowerCase()})`}
        className="flex aspect-square w-full items-center justify-center p-1"
      >
        {sprite ? (
          <img
            src={sprite}
            alt={gambit.name}
            className="pixel block h-9 w-9 object-contain"
            draggable={false}
          />
        ) : (
          <span className="font-mono text-[9px] leading-tight">
            {gambitDisplayName(gambit).slice(0, 6)}
          </span>
        )}
      </PixelToggle>
    </GambitTooltip>
  );
}

