# Gambonanza Seed Finder

Brute-force search for run seeds with chosen starter pieces and gachapon
rarity rolls. Everything runs in the browser — Rust → WebAssembly hot loop,
fanned out across 4 Web Workers.

## Develop

```bash
npm install
npm run build:wasm   # builds rng-wasm/pkg/
npm run dev
```

## Test

```bash
npm test            # search-manager end-to-end (drives WASM via workers)
npm run test:wasm   # native cargo test against the Python reference vectors
```

## Build

```bash
npm run build       # rebuilds wasm + bundles dist/
npm run preview
```

## How it works

`rng-wasm/` is a small Rust crate that ports the game's FNV-1a + Park-Miller
RNG. It exposes both the bulk `search_range` kernel (used by the workers)
and per-seed helpers (`simulateStarters`, `gachaponRoll`) that the main
thread calls to render the inspector. Native `cargo test` pins the Rust
port to vectors generated from the Python reference in `seedfinder/`, so
the wasm we ship matches the game byte-for-byte.

`src/rng/` is a thin TS shim: types + lazy WASM init + a couple of
helpers that wrap the wasm-bindgen exports. There is no second TS port.

`src/search/` owns the worker pool, filter wire format and the
`SearchManager` that fans the u32 seed space across 4 web workers.

## Assets

Sprite art and the `VCRosdNEUE` font in `public/game/` are extracted from
the Gambonanza install and used here as a fan-made companion tool. They
remain the property of their respective authors.

## Layout

```
.github/workflows/deploy.yml   GitHub Actions → Pages
rng-wasm/                      Rust crate, compiled to wasm32
  src/lib.rs                   RNG, occurrence helpers, search_range kernel
src/
  rng/                         types + lazy WASM init shim
  search/                      worker + manager + filter encoding
  components/                  React UI (Tailwind v4)
  App.tsx                      shell
```
