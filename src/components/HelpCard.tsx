import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import type { Rarity } from "../rng";
import {
  gambitDisplayName,
  gambitSpriteUrl,
  getGambitById,
} from "../rng";
import { TIER_BG } from "../rng/rarityColors";
import { GambitTooltip } from "./GambitTooltip";
import { RarityBadge } from "./ui/RarityBadge";

export function HelpCard() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chip-cream text-xs uppercase tracking-wider"
      >
        How does this work?
      </button>
    );
  }

  return (
    <aside className="card-cream space-y-5 p-4 text-sm text-[var(--color-wine-dark)] sm:p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-lg uppercase tracking-wider">
          Reading the predictions
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70 hover:text-[var(--color-wine)]"
        >
          dismiss
        </button>
      </header>

      <Intro />

      <Anatomy />

      <Scenarios />

      <Pitfalls />

      <p className="text-xs text-[var(--color-wine-dark)]/70">
        Tier bands: <Band r="COMMON">0–39 common</Band>{" "}
        <Band r="RARE">40–69 rare</Band> <Band r="EPIC">70–89 epic</Band>{" "}
        <Band r="LEGENDARY">90–100 legendary</Band>. The 3 specific gambits
        inside a tier come from the eligible pool at that moment — unlocks,
        equipped gambits, and current shop offers can all change it.
      </p>
    </aside>
  );
}

function Intro() {
  return (
    <div className="space-y-2">
      <p>
        Every gachapon's rarity is decided by a single roll keyed by{" "}
        <Code>(seed, wave, counter)</Code>.
      </p>
      <ul className="ml-4 list-disc space-y-1 text-[var(--color-wine-dark)]/90">
        <li>
          <strong>counter</strong> — a run-wide integer that starts at{" "}
          <Code>0</Code> and ticks up <em>only</em> when you actually spin a
          gachapon. Buying pieces / gambits / tokens / rerolls does not move
          it.
        </li>
        <li>
          <strong>wave</strong> — under normal play this is{" "}
          <em>which shop you're in</em>, 1-indexed. The game increments
          it by 1 every time you win a game, and shops happen between
          games — so the shop after Game 1 is wave 1, after Game 2 is
          wave 2, and so on. Internally it's the field shown on the HUD
          as <Code>Stage X/5  Game N/5</Code>, with{" "}
          <Code>wave = (X − 1) × 5 + (N − 1)</Code>.
        </li>
      </ul>
    </div>
  );
}

function Anatomy() {
  return (
    <section className="space-y-2">
      <h3 className="font-display text-xs uppercase tracking-wider">
        Reading the roll grid
      </h3>
      <p>
        Rows are <strong>counters</strong>, columns are <strong>waves</strong>.
        A cell at row <Code>c</Code> column <Code>w</Code> answers: “if my{" "}
        <em>(c+1)</em>-th gachapon spin happens during wave <em>w</em>, what
        rarity comes out?”
      </p>
      <div className="flex flex-wrap items-start gap-5 pt-1">
        <MiniGrid
          cols={5}
          rows={3}
          tiers={[
            ["COMMON", "RARE", "COMMON", "LEGENDARY", "COMMON"],
            ["EPIC", "COMMON", "RARE", "RARE", "EPIC"],
            ["COMMON", "LEGENDARY", "EPIC", "COMMON", "RARE"],
          ]}
          highlight={{ c: 1, w: 3 }}
        />
        <div className="max-w-xs space-y-1.5 text-[12px] text-[var(--color-wine-dark)]/90">
          <Legend
            swatch={<Arrow dir="down" />}
            text={
              <>
                <strong>down</strong> = you spun a gachapon
                <span className="text-[var(--color-wine-dark)]/60">
                  {" "}
                  (counter +1)
                </span>
              </>
            }
          />
          <Legend
            swatch={<Arrow dir="right" />}
            text={
              <>
                <strong>right</strong> = you moved on without spinning
                <span className="text-[var(--color-wine-dark)]/60">
                  {" "}
                  (wave +1)
                </span>
              </>
            }
          />
          <Legend
            swatch={<HiCell />}
            text={
              <>
                The bordered cell reads:
                <span className="text-[var(--color-wine-dark)]/60">
                  {" "}
                  “my 2nd spin lands on wave 3 → <strong>RARE</strong>”.
                </span>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Scenarios() {
  return (
    <section className="space-y-2">
      <h3 className="font-display text-xs uppercase tracking-wider">
        Walk-throughs
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Scenario
          title="Spin every shop"
          desc="One gachapon per wave, never skip. Each spin steps one cell down-right — you trace a diagonal."
          grid={{
            cols: 5,
            rows: 4,
            tiers: [
              ["COMMON", "RARE", "EPIC", "COMMON", "LEGENDARY"],
              ["EPIC", "COMMON", "RARE", "COMMON", "RARE"],
              ["RARE", "EPIC", "LEGENDARY", "COMMON", "EPIC"],
              ["COMMON", "COMMON", "RARE", "EPIC", "COMMON"],
            ],
            path: [
              { c: 0, w: 1 },
              { c: 1, w: 2 },
              { c: 2, w: 3 },
              { c: 3, w: 4 },
            ],
          }}
        />
        <Scenario
          title="Skip the first shop's gachapon"
          desc="No spin during wave 1 → counter stays at 0. Spin in wave 2 → cell (c=0, w=2). Counter only advances when you commit."
          grid={{
            cols: 5,
            rows: 3,
            tiers: [
              ["COMMON", "RARE", "EPIC", "COMMON", "LEGENDARY"],
              ["EPIC", "COMMON", "RARE", "COMMON", "RARE"],
              ["RARE", "EPIC", "LEGENDARY", "COMMON", "EPIC"],
            ],
            path: [
              { c: 0, w: 2, label: "spin" },
              { c: 1, w: 3, label: "spin" },
            ],
            ghost: [{ c: 0, w: 1, label: "skipped" }],
          }}
        />
        <Scenario
          title="Two gachapons in one shop"
          desc="Same wave column, two cells stacked. The counter ticks between them even though the wave didn't change."
          grid={{
            cols: 5,
            rows: 4,
            tiers: [
              ["COMMON", "RARE", "EPIC", "COMMON", "LEGENDARY"],
              ["EPIC", "COMMON", "RARE", "COMMON", "RARE"],
              ["RARE", "EPIC", "LEGENDARY", "COMMON", "EPIC"],
              ["COMMON", "COMMON", "RARE", "EPIC", "COMMON"],
            ],
            path: [
              { c: 0, w: 2, label: "spin 1" },
              { c: 1, w: 2, label: "spin 2" },
              { c: 2, w: 3 },
            ],
          }}
        />
      </div>
    </section>
  );
}

function Pitfalls() {
  return (
    <section className="space-y-1.5">
      <h3 className="font-display text-xs uppercase tracking-wider">
        Why a prediction can miss
      </h3>
      <ul className="ml-4 list-disc space-y-1 text-[var(--color-wine-dark)]/85">
        <li>
          You spun (or skipped) a gachapon you didn't plan on. Each accidental
          spin shifts every following row by one.
        </li>
        <li>
          You spun at a different wave than the row's column. Same{" "}
          <em>counter</em>, different <em>wave</em> = different roll.
        </li>
        <li>
          <GambitMention id="lucky-coin" /> is equipped. While it's on the
          board the rolled rarity is ignored and every gachapon forces{" "}
          <Band r="LEGENDARY">legendary</Band>.
        </li>
        <li>
          Your save is missing some gambit unlocks. The <em>rarity</em>{" "}
          still matches, but the 3 gambits inside the tier depend on which
          ones are unlocked.{" "}
          <span className="text-[var(--color-wine-dark)]/60">
            Use the gear icon beside <em>Gambits</em> to tell the predictor
            which ones you have.
          </span>
        </li>
        <li>
          A gambit is currently offered in the shop. The game excludes shop
          offers from gachapon choices — even if the shop offer is not the
          predicted gambit. Removing a later gambit in the same rarity pool
          can shift the same RNG roll from, for example, Phantom Bride to
          Pendant. This depends on live run state, rerolls, locks, and build
          bias, so it cannot always be recovered from seed alone.
        </li>
        <li>
          A gambit is already equipped in the run or locked in a shop slot.
          Those are excluded from the pool too, and can shift the specific
          gambits while leaving the rarity roll unchanged.
        </li>
      </ul>
    </section>
  );
}

/* ----------------------------- visual atoms ------------------------------ */

interface CellMark {
  c: number;
  w: number;
  label?: string;
}

interface MiniGridProps {
  cols: number;
  rows: number;
  /** `tiers[c][w-1]` is the rarity shown in cell (c, w). */
  tiers: Rarity[][];
  /** Cells to outline. */
  highlight?: CellMark;
  /** Sequential play path; renders ordered numeric markers and arrows. */
  path?: CellMark[];
  /** Faded "could have happened" cells (e.g. skipped). */
  ghost?: CellMark[];
}

/**
 * Small explanatory grid used by the HOW IT WORKS scenarios. Rebuilt
 * as a CSS Grid (was a <table> which auto-sized columns to content,
 * so cells with numbers ended up wider than empty cells). Same pattern
 * as the main RollGrid — fixed column widths, fixed row heights, hits
 * use box-shadow rings so widths don't shift.
 */
function MiniGrid({
  cols,
  rows,
  tiers,
  highlight,
  path = [],
  ghost = [],
}: MiniGridProps) {
  const pathIdx = new Map(path.map((p, i) => [`${p.c}:${p.w}`, i]));
  const ghostKeys = new Set(ghost.map((g) => `${g.c}:${g.w}`));
  const highlightKey = highlight ? `${highlight.c}:${highlight.w}` : null;

  return (
    <div className="inline-block">
      <div
        className="inline-grid gap-1 font-mono text-[10px]"
        style={{
          gridTemplateColumns: `1.5rem repeat(${cols}, 2.25rem)`,
          gridAutoRows: "1.75rem",
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-end pr-0.5 text-[var(--color-wine-dark)]/60">
          c\w
        </div>
        {Array.from({ length: cols }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[var(--color-wine-dark)]/60"
          >
            {i + 1}
          </div>
        ))}

        {/* Body rows */}
        {Array.from({ length: rows }, (_, r) => (
          <Fragment key={r}>
            <div className="flex items-center justify-end pr-0.5 text-[var(--color-wine-dark)]/60">
              {r}
            </div>
            {Array.from({ length: cols }, (_, c) => {
              const w = c + 1;
              const key = `${r}:${w}`;
              const tier = tiers[r]?.[c] ?? "COMMON";
              const pathOrder = pathIdx.get(key);
              const isGhost = ghostKeys.has(key);
              const isHi = key === highlightKey;

              // Outer-ring shadows so cell widths stay exactly equal
              // regardless of highlight state. Path cells (numbered)
              // also get the lifted look so the play path stands out.
              const isPath = pathOrder !== undefined;
              const boxShadow = isHi
                ? "0 0 0 2px var(--color-ink), 0 2px 0 2px var(--color-ink)"
                : isPath
                  ? "0 0 0 2px var(--color-ink), 0 2px 0 2px var(--color-ink)"
                  : "inset 0 0 0 1px rgba(90, 34, 48, 0.15)";

              return (
                <div
                  key={c}
                  className={`flex items-center justify-center rounded-sm ${TIER_BG[tier]} ${isGhost ? "opacity-30" : ""}`}
                  style={{ boxShadow }}
                >
                  {pathOrder !== undefined && (
                    <span className="font-display text-[10px] uppercase tracking-wider text-[var(--color-ink)]">
                      {pathOrder + 1}
                    </span>
                  )}
                  {isGhost && !isPath && (
                    <span className="font-display text-[9px] uppercase text-[var(--color-wine-dark)]/70">
                      ✕
                    </span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      {(path.length > 0 || ghost.length > 0) && (
        <div className="mt-1 space-y-0.5 text-[10px] text-[var(--color-wine-dark)]/70">
          {path.map((p, i) =>
            p.label ? (
              <div key={`p${i}`}>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-[var(--color-wine-dark)]/30 bg-[var(--color-cream-light)] font-display text-[9px] text-[var(--color-ink)]">
                  {i + 1}
                </span>{" "}
                {p.label} <span className="opacity-60">(c={p.c}, w={p.w})</span>
              </div>
            ) : null,
          )}
          {ghost.map((g, i) => (
            <div key={`g${i}`}>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-[var(--color-wine-dark)]/30 bg-[var(--color-cream-light)] text-[var(--color-wine-dark)]/70">
                ✕
              </span>{" "}
              {g.label ?? "skipped"}{" "}
              <span className="opacity-60">(c={g.c}, w={g.w})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ScenarioProps {
  title: string;
  desc: string;
  grid: MiniGridProps;
}

function Scenario({ title, desc, grid }: ScenarioProps) {
  return (
    <div className="space-y-1.5 rounded-md bg-[var(--color-cream-light)]/60 p-3">
      <div className="font-display text-[12px] uppercase tracking-wider text-[var(--color-wine)]">
        {title}
      </div>
      <div className="overflow-x-auto">
        <MiniGrid {...grid} />
      </div>
      <p className="text-[11px] leading-snug text-[var(--color-wine-dark)]/85">
        {desc}
      </p>
    </div>
  );
}

/**
 * Inline reference to a specific gambit by ID — renders its sprite +
 * localized name as a small chip with the same hover tooltip used in
 * the picker. Falls back to a plain code-style chip if the ID isn't in
 * the registry (e.g. if the gambit was renamed in a future build).
 */
function GambitMention({ id }: { id: string }) {
  const g = getGambitById(id);
  if (!g) {
    return <Code>{id}</Code>;
  }
  const sprite = gambitSpriteUrl(g);
  return (
    <GambitTooltip gambit={g}>
      <span
        tabIndex={0}
        className="inline-flex cursor-help items-center gap-1 rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-cream-light)] px-1.5 py-0 align-text-bottom font-display text-[11px] uppercase tracking-wider text-[var(--color-wine)] shadow-[0_1px_0_0_var(--color-ink)]"
      >
        {sprite && (
          <img
            src={sprite}
            alt={g.name}
            className="pixel block h-4 w-4 object-contain"
            draggable={false}
          />
        )}
        <span>{gambitDisplayName(g)}</span>
      </span>
    </GambitTooltip>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-wine)]/15 px-1 py-0.5 font-mono text-[12px] text-[var(--color-wine)]">
      {children}
    </code>
  );
}

function Band({ r, children }: { r: Rarity; children: ReactNode }) {
  return (
    <RarityBadge rarity={r} size="sm" variant="inline">
      {children}
    </RarityBadge>
  );
}

function Legend({ swatch, text }: { swatch: ReactNode; text: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-5 w-5 items-center justify-center">
        {swatch}
      </span>
      <span>{text}</span>
    </div>
  );
}

function Arrow({ dir }: { dir: "down" | "right" }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-wine)]"
      aria-hidden="true"
    >
      {dir === "down" ? (
        <>
          <path d="M12 5v14" />
          <path d="m6 13 6 6 6-6" />
        </>
      ) : (
        <>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </>
      )}
    </svg>
  );
}

function HiCell() {
  return (
    <span className="inline-block h-3 w-4 rounded-sm border-2 border-[var(--color-ink)] bg-[var(--color-rare)] shadow-[0_1px_0_0_var(--color-ink)]" />
  );
}
