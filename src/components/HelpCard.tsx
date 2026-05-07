import { useState } from "react";

export function HelpCard() {
  const [open, setOpen] = useState(false);

  const dismiss = () => setOpen(false);

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
    <aside className="card-cream space-y-3 p-4 text-sm text-[var(--color-wine-dark)]">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-lg uppercase tracking-wider">
          Reading the predictions
        </h2>
        <button
          type="button"
          onClick={dismiss}
          className="text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70 hover:text-[var(--color-wine)]"
        >
          dismiss
        </button>
      </header>

      <p>
        Each gachapon's rarity comes from a single roll keyed by{" "}
        <code className="rounded bg-[var(--color-wine)]/15 px-1 py-0.5 font-mono text-[var(--color-wine)]">
          (seed, wave, counter)
        </code>
        . <em>counter</em> is a per-run integer that starts at 0 and increments
        every time a gachapon is spun. <em>wave</em> is the run wave at the
        moment of the spin.
      </p>

      <p>
        Only spinning a gachapon advances its counter. Buying pieces, gambits,
        tile/piece tokens, or rerolls does not.
      </p>

      <div>
        <p className="mb-1 font-display uppercase tracking-wider">
          Why a prediction can miss
        </p>
        <ul className="ml-4 list-disc space-y-1 text-[var(--color-wine-dark)]/85">
          <li>
            You spun a gachapon you didn't plan on. Predictions assume a
            specific counter at a specific wave; an extra spin shifts every
            following row.
          </li>
          <li>
            You spun at a different wave than the row's <em>wave</em> column.
            Same seed and counter, different wave = different roll.
          </li>
          <li>
            You spun two gachapons in the same shop. Same wave, but the counter
            still advances between them. Use the per-row <em>wave</em>/
            <em>counter</em> fields to model that.
          </li>
          <li>
            The <code className="font-mono">LuckyCoin</code> gambit is equipped.
            While it's on the board the game ignores the rolled rarity and
            forces every gachapon to LEGENDARY.
          </li>
        </ul>
      </div>

      <p className="text-xs text-[var(--color-wine-dark)]/70">
        The roll's bands are 0–39 common, 40–69 rare, 70–89 epic, 90–100
        legendary. This app predicts the rarity tier, not the three specific
        gambits inside a tier (which depend on your account's gambit unlocks).
      </p>
    </aside>
  );
}
