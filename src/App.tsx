import { useCallback, useEffect, useRef, useState } from "react";
import { GachaponGrid } from "./components/GachaponGrid";
import { HelpCard } from "./components/HelpCard";
import { ResultsTable } from "./components/ResultsTable";
import { SearchStatus } from "./components/SearchStatus";
import { StarterPicker } from "./components/StarterPicker";
import { ChipLink } from "./components/ui/Chip";
import { SearchManager } from "./search/searchManager";
import type { GachaponFilter, StarterFilter } from "./search/types";

const RESULTS_BATCH_INTERVAL = 100;
const MAX_RESULTS_KEPT = 1000;
const DEFAULT_WORKER_COUNT = 4;

const initialStarter: StarterFilter = {
  slots: ["QUEEN", "QUEEN", "QUEEN"],
  unordered: true,
};

export function App() {
  const [starter, setStarter] = useState<StarterFilter>(initialStarter);
  const [gachapons, setGachapons] = useState<GachaponFilter[]>([]);

  const [results, setResults] = useState<number[]>([]);
  const [active, setActive] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [matched, setMatched] = useState(0);
  const [total, setTotal] = useState(0);
  const [rate, setRate] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<SearchManager | null>(null);
  const resultBufferRef = useRef<number[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const flushResults = useCallback(() => {
    flushTimerRef.current = null;
    if (resultBufferRef.current.length === 0) return;
    const incoming = resultBufferRef.current;
    resultBufferRef.current = [];
    setResults((prev) => {
      const merged = prev.concat(incoming);
      if (merged.length > MAX_RESULTS_KEPT) {
        return merged.slice(0, MAX_RESULTS_KEPT);
      }
      return merged;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(flushResults, RESULTS_BATCH_INTERVAL);
  }, [flushResults]);

  const stopSearch = useCallback(() => {
    managerRef.current?.cancel();
    managerRef.current = null;
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushResults();
    setActive(false);
  }, [flushResults]);

  const startSearch = useCallback(() => {
    stopSearch();
    setResults([]);
    resultBufferRef.current = [];
    setError(null);
    setScanned(0);
    setMatched(0);
    setTotal(0);
    setRate(0);
    startTimeRef.current = performance.now();
    setActive(true);

    const manager = new SearchManager({
      workerCount: DEFAULT_WORKER_COUNT,
      onResult: (seeds) => {
        if (resultBufferRef.current.length < MAX_RESULTS_KEPT) {
          resultBufferRef.current.push(...seeds);
          scheduleFlush();
        }
      },
      onProgress: (s, m, t) => {
        setScanned(s);
        setMatched(m);
        setTotal(t);
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        setRate(elapsed > 0 ? s / elapsed : 0);
      },
      onDone: () => {
        flushResults();
        setActive(false);
      },
      onError: (msg) => {
        setError(msg);
        setActive(false);
      },
    });
    managerRef.current = manager;
    manager.start({ starter, gachapons });
  }, [starter, gachapons, flushResults, scheduleFlush, stopSearch]);

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
        <ChipLink
          href="https://github.com/bentrd/seedfinder-web"
          target="_blank"
          rel="noreferrer"
        >
          source
        </ChipLink>
      </header>

      <HelpCard />

      <div className="grid flex-1 grid-cols-1 items-start gap-8 md:grid-cols-[420px_1fr]">
        <aside className="card-window space-y-6">
          <span className="window-title">Filters</span>

          <StarterPicker
            value={starter}
            onChange={(next) => {
              setStarter(next);
              if (active) stopSearch();
            }}
          />

          <GachaponGrid
            value={gachapons}
            onChange={(next) => {
              setGachapons(next);
              if (active) stopSearch();
            }}
          />

          {!active ? (
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

          <SearchStatus
            active={active}
            scanned={scanned}
            matched={matched}
            total={total}
            rate={rate}
            onCancel={stopSearch}
          />

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
          <ResultsTable seeds={results} gachaponFilters={gachapons} />
          {results.length >= MAX_RESULTS_KEPT && (
            <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/70">
              Showing first {MAX_RESULTS_KEPT} matches
            </p>
          )}
        </main>
      </div>

      <footer className="mt-4 text-center text-[11px] uppercase tracking-wider text-[var(--color-cream)]/40">
        Fan-made companion tool. Sprites & font are property of their authors.
      </footer>
    </div>
  );
}
