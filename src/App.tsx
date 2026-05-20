import { useCallback, useEffect, useRef, useState } from "react";
import { CRTOverlay } from "./components/CRTOverlay";
import { FilterChangeConfirmModal } from "./components/FilterChangeConfirmModal";
import { GachaponGrid } from "./components/GachaponGrid";
import { GambitPicker } from "./components/GambitPicker";
import { GambitUnlocksModal } from "./components/GambitUnlocksModal";
import { HelpCard } from "./components/HelpCard";
import { ResultsTable } from "./components/ResultsTable";
import { SearchStatus } from "./components/SearchStatus";
import { StarterPicker } from "./components/StarterPicker";
import { ChipLink } from "./components/ui/Chip";
import { defaultGambitFilter } from "./search/encode";
import { SearchManager } from "./search/searchManager";
import type {
  GachaponFilter,
  GambitFilter,
  StarterFilter,
} from "./search/types";

const EXCLUDED_LS_KEY = "gambonanza:excluded-gambits";
const RESET_WARN_LS_KEY = "gambonanza:skip-reset-warning";
const RESULTS_FLUSH_INTERVAL_MS = 100;
const BATCH_SIZE = 100;

function loadExcludedFromStorage(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXCLUDED_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function persistExcluded(ids: readonly string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(EXCLUDED_LS_KEY, JSON.stringify(ids));
  } catch {
    // quota / private mode — silently ignore
  }
}

function loadSkipResetWarning(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(RESET_WARN_LS_KEY) === "1";
}

function persistSkipResetWarning(skip: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (skip) localStorage.setItem(RESET_WARN_LS_KEY, "1");
    else localStorage.removeItem(RESET_WARN_LS_KEY);
  } catch {
    // ignore
  }
}

const initialStarter: StarterFilter = {
  slots: ["QUEEN", "QUEEN", "QUEEN"],
  unordered: true,
};

export function App() {
  const [starter, setStarter] = useState<StarterFilter>(initialStarter);
  const [gachapons, setGachapons] = useState<GachaponFilter[]>([]);
  const [gambits, setGambits] = useState<GambitFilter>(() => ({
    ...defaultGambitFilter(),
    excludedIds: loadExcludedFromStorage(),
  }));
  const [unlocksOpen, setUnlocksOpen] = useState(false);

  // --- search state ---
  const [results, setResults] = useState<number[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  /** True between a `start`/`requestNext` call and the matching `paused`/`exhausted`. */
  const [fetching, setFetching] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [matched, setMatched] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [target, setTarget] = useState(0);
  const [rate, setRate] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // --- filter-change confirmation modal ---
  const [pendingChange, setPendingChange] = useState<(() => void) | null>(null);
  const [skipResetWarning, setSkipResetWarning] = useState<boolean>(
    loadSkipResetWarning,
  );

  // --- refs ---
  const managerRef = useRef<SearchManager | null>(null);
  const resultBufferRef = useRef<number[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  /** Drain `resultBufferRef` into `results` state on a debounced timer. */
  const flushResults = useCallback(() => {
    flushTimerRef.current = null;
    if (resultBufferRef.current.length === 0) return;
    const incoming = resultBufferRef.current;
    resultBufferRef.current = [];
    setResults((prev) => prev.concat(incoming));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(
      flushResults,
      RESULTS_FLUSH_INTERVAL_MS,
    );
  }, [flushResults]);

  const stopSearch = useCallback(() => {
    managerRef.current?.cancel();
    managerRef.current = null;
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushResults();
    setFetching(false);
  }, [flushResults]);

  const startSearch = useCallback(() => {
    stopSearch();
    setResults([]);
    resultBufferRef.current = [];
    setError(null);
    setScanned(0);
    setMatched(0);
    setTarget(BATCH_SIZE);
    setRate(0);
    setExhausted(false);
    setHasSearched(true);
    setFetching(true);
    startTimeRef.current = performance.now();

    const manager = new SearchManager({
      batchSize: BATCH_SIZE,
      onResult: (seeds) => {
        resultBufferRef.current.push(...seeds);
        scheduleFlush();
      },
      onProgress: (state) => {
        setMatched(state.matched);
        setScanned(state.scanned);
        setTarget(state.target);
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        setRate(elapsed > 0 ? state.scanned / elapsed : 0);
      },
      onPaused: () => {
        flushResults();
        setFetching(false);
      },
      onExhausted: () => {
        flushResults();
        setExhausted(true);
        setFetching(false);
      },
      onError: (msg) => {
        setError(msg);
        setFetching(false);
      },
    });
    managerRef.current = manager;
    manager.start({ starter, gachapons, gambits });
  }, [starter, gachapons, gambits, flushResults, scheduleFlush, stopSearch]);

  const requestMore = useCallback(() => {
    if (!managerRef.current || exhausted || fetching) return;
    setFetching(true);
    startTimeRef.current = performance.now();
    managerRef.current.requestNext();
  }, [exhausted, fetching]);

  // --- filter change guard ---
  /**
   * Wraps an arbitrary filter mutation in a confirmation gate. If a
   * search has already produced results, we ask the user before
   * blowing the table away. The "never show again" flag in
   * localStorage bypasses the modal entirely.
   */
  const guardFilterChange = useCallback(
    (apply: () => void) => {
      const hasState = hasSearched && (results.length > 0 || fetching);
      if (!hasState || skipResetWarning) {
        apply();
        if (managerRef.current) {
          // A search was running or finished — drop it so the user gets a
          // fresh batch on next "Search!" click.
          stopSearch();
          setHasSearched(false);
          setResults([]);
          setMatched(0);
          setScanned(0);
          setTarget(0);
          setExhausted(false);
        }
        return;
      }
      setPendingChange(() => () => {
        apply();
        stopSearch();
        setHasSearched(false);
        setResults([]);
        setMatched(0);
        setScanned(0);
        setTarget(0);
        setExhausted(false);
      });
    },
    [hasSearched, results.length, fetching, skipResetWarning, stopSearch],
  );

  useEffect(() => {
    return () => {
      managerRef.current?.cancel();
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-7 px-6 py-10">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-display text-3xl uppercase tracking-wider text-[var(--color-cream)] drop-shadow-[0_3px_0_var(--color-ink)]">
          Gambonanza Seed Finder
        </h1>
        <div className="flex items-center gap-2">
          <CRTOverlay />
          <ChipLink
            href="https://github.com/bentrd/gambonanza-seedfinder"
            target="_blank"
            rel="noreferrer"
          >
            source
          </ChipLink>
        </div>
      </header>

      <HelpCard />

      <div className="flex flex-1 flex-col gap-8">
        <aside className="card-window space-y-6">
          <span className="window-title">Filters</span>

          {/* Three filter sections side-by-side on md+; stacked on mobile.
              The row's height is locked to the StarterPicker's natural
              height (3 rows of square toggles ≈ 280px). Locking it here
              instead of letting the tallest sibling dictate makes the
              GambitPicker's scroll area kick in instead of stretching
              the row, and keeps the layout stable as filters change. */}
          <div className="grid gap-6 md:grid-cols-3 md:auto-rows-[280px]">
            <StarterPicker
              value={starter}
              onChange={(next) => guardFilterChange(() => setStarter(next))}
            />

            <GachaponGrid
              value={gachapons}
              onChange={(next) => guardFilterChange(() => setGachapons(next))}
            />

            <GambitPicker
              value={gambits}
              onChange={(next) => guardFilterChange(() => setGambits(next))}
              onOpenUnlocks={() => setUnlocksOpen(true)}
            />
          </div>

          {/* Centered control strip: status card on top, Search/Stop
              button below, both at the same ~1/3 panel width. Stacked
              instead of side-by-side because each card has its own
              natural height (the status is information-dense; the
              button is chunky) — forcing them to share a row meant one
              always looked stretched or cramped. */}
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 md:w-1/3">
            {hasSearched ? (
              <SearchStatus
                fetching={fetching}
                exhausted={exhausted}
                matched={matched}
                target={target}
                scanned={scanned}
                rate={rate}
                onCancel={stopSearch}
              />
            ) : (
              <div className="inset-row text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
                Pick filters, then hit Search.
              </div>
            )}

            {!fetching ? (
              <button
                type="button"
                onClick={startSearch}
                className="btn-green w-full text-lg uppercase"
              >
                Search!
              </button>
            ) : (
              <button
                type="button"
                onClick={stopSearch}
                className="btn-wine w-full text-lg uppercase"
              >
                Stop
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-wine)] px-3 py-2 text-xs uppercase tracking-wider text-[var(--color-cream)]">
              {error}
            </div>
          )}
        </aside>

        <main className="card-window">
          <span className="window-title">
            Results
            {results.length > 0 && (
              <span className="ml-2 opacity-70">({results.length})</span>
            )}
          </span>
          <ResultsTable
            seeds={results}
            gachaponFilters={gachapons}
            gambitFilter={gambits}
            fetching={fetching}
            exhausted={exhausted}
            hasSearched={hasSearched}
            onLoadMore={requestMore}
          />
        </main>
      </div>

      <footer className="mt-4 text-center text-[11px] uppercase tracking-wider text-[var(--color-cream)]/40">
        Fan-made companion tool. Sprites & font are property of their authors.
      </footer>

      <GambitUnlocksModal
        open={unlocksOpen}
        excludedIds={gambits.excludedIds}
        onChange={(excludedIds) => {
          persistExcluded(excludedIds);
          guardFilterChange(() =>
            setGambits((g) => ({ ...g, excludedIds })),
          );
        }}
        onClose={() => setUnlocksOpen(false)}
      />

      <FilterChangeConfirmModal
        open={pendingChange !== null}
        skipNextTime={skipResetWarning}
        onSkipNextTimeChange={(next) => {
          setSkipResetWarning(next);
          persistSkipResetWarning(next);
        }}
        onConfirm={() => {
          pendingChange?.();
          setPendingChange(null);
        }}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
}
