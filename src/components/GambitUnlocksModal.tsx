import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Gambit, Rarity } from "../rng";
import {
  gambitDescriptionPlain,
  gambitDisplayName,
  gambitSpriteUrl,
  getGambits,
} from "../rng";
import { TIER_BG } from "../rng/rarityColors";
import { GambitTooltip } from "./GambitTooltip";
import { ChipButton } from "./ui/Chip";
import { PixelToggle } from "./ui/PixelToggle";

interface GambitUnlocksModalProps {
  open: boolean;
  excludedIds: readonly string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}

/**
 * "My unlocked gambits" modal. Each toggle represents a gambit's
 * unlocked state — active means "you have it unlocked", inactive means
 * "locked on your save" (added to the exclusion list). Defaults to all
 * unlocked.
 *
 * Why a separate modal rather than reusing GambitPicker: the picker
 * encodes "match these" (additive), while this encodes "don't simulate
 * these" (subtractive). Same data, opposite semantic — clearer to give
 * each its own surface.
 */
export function GambitUnlocksModal({
  open,
  excludedIds,
  onChange,
  onClose,
}: GambitUnlocksModalProps) {
  const all = useMemo(() => getGambits(), []);
  const [query, setQuery] = useState("");

  // Lock the document scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);

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
    const order: Rarity[] = ["LEGENDARY", "EPIC", "RARE", "COMMON"];
    return order.map((r) => ({
      rarity: r,
      gambits: filtered.filter((g) => g.rarity === r),
    }));
  }, [filtered]);

  const toggle = (g: Gambit) => {
    const next = new Set(excludedSet);
    if (next.has(g.id)) next.delete(g.id);
    else next.add(g.id);
    onChange(Array.from(next));
  };

  const setAllUnlocked = () => onChange([]);
  const setAllLocked = () => onChange(all.map((g) => g.id));

  const lockedCount = excludedSet.size;
  const unlockedCount = all.length - lockedCount;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gambit-unlocks-title"
    >
      <div
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="card-window relative z-10 mt-6 flex max-h-[85vh] w-full max-w-3xl flex-col">
        <span className="window-title" id="gambit-unlocks-title">
          My unlocked gambits
        </span>

        <div className="mb-3 flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70">
            tick what you have on your save
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream-light)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-wine-dark)]">
            <span className="font-display uppercase tracking-wider">
              unlocked
            </span>
            <span className="text-[var(--color-wine)]">{unlockedCount}</span>
            <span className="text-[var(--color-wine-dark)]/40">/</span>
            <span>{all.length}</span>
          </span>
          <ChipButton onClick={setAllUnlocked} disabled={lockedCount === 0}>
            unlock all
          </ChipButton>
          <ChipButton onClick={setAllLocked} disabled={lockedCount === all.length}>
            lock all
          </ChipButton>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search gambits, focus tags, descriptions…"
          className="input-game mb-3 w-full"
          aria-label="search gambits"
        />

        <div className="flex-1 space-y-3 overflow-y-auto rounded-md bg-[var(--color-cream-soft)]/30 p-3">
          {grouped.every((g) => g.gambits.length === 0) ? (
            <p className="px-2 py-8 text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
              No gambits match “{query}”
            </p>
          ) : (
            grouped.map(({ rarity, gambits }) =>
              gambits.length === 0 ? null : (
                <RaritySection
                  key={rarity}
                  rarity={rarity}
                  gambits={gambits}
                  excludedSet={excludedSet}
                  onToggle={toggle}
                />
              ),
            )
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
            stored locally — only affects gachapon predictions in this browser
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-cream text-sm uppercase"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface RaritySectionProps {
  rarity: Rarity;
  gambits: readonly Gambit[];
  excludedSet: Set<string>;
  onToggle: (g: Gambit) => void;
}

function RaritySection({
  rarity,
  gambits,
  excludedSet,
  onToggle,
}: RaritySectionProps) {
  const unlockedHere = gambits.filter((g) => !excludedSet.has(g.id)).length;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span
          className={`inline-block rounded-md border-2 border-[var(--color-ink)] px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-[var(--color-ink)] ${TIER_BG[rarity]}`}
        >
          {rarity.toLowerCase()}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
          {unlockedHere} / {gambits.length}
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {gambits.map((g) => (
          <UnlockToggle
            key={g.id}
            gambit={g}
            unlocked={!excludedSet.has(g.id)}
            onClick={() => onToggle(g)}
          />
        ))}
      </div>
    </div>
  );
}

interface UnlockToggleProps {
  gambit: Gambit;
  unlocked: boolean;
  onClick: () => void;
}

function UnlockToggle({ gambit, unlocked, onClick }: UnlockToggleProps) {
  const sprite = gambitSpriteUrl(gambit);
  return (
    <GambitTooltip gambit={gambit}>
      <PixelToggle
        active={unlocked}
        onClick={onClick}
        aria-pressed={unlocked}
        aria-label={`${gambitDisplayName(gambit)} (${unlocked ? "unlocked" : "locked"})`}
        className="relative flex aspect-square w-full items-center justify-center p-1"
      >
        {sprite ? (
          <img
            src={sprite}
            alt={gambit.name}
            className={`pixel block h-9 w-9 object-contain transition ${
              unlocked ? "" : "grayscale opacity-30"
            }`}
            draggable={false}
          />
        ) : (
          <span
            className={`font-mono text-[9px] leading-tight ${unlocked ? "" : "opacity-40"}`}
          >
            {gambitDisplayName(gambit).slice(0, 6)}
          </span>
        )}
        {!unlocked && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-wine)] font-display text-[8px] text-[var(--color-cream)] shadow-[0_1px_0_0_var(--color-ink)]"
          >
            ✕
          </span>
        )}
      </PixelToggle>
    </GambitTooltip>
  );
}
