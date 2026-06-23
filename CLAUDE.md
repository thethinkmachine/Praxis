# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Praxis is a React + TypeScript visualizer/educational tool for AI algorithms (graph search, game playing, local search, planning, CSP). Each algorithm runs as a generator that yields replayable steps, which a shared execution engine records and a page shell steps through.

## Commands

```bash
npm run dev          # start Vite dev server
npm run build         # tsc -b && vite build (type-check then build)
npm run lint          # eslint .
npm test              # vitest run (single run, all tests)
npm run test:watch    # vitest watch mode
npm run preview        # preview production build
```

Run a single test file: `npx vitest run src/__tests__/algorithms.test.ts`
Run tests matching a name: `npx vitest run -t "pattern"`

There is no e2e suite wired up yet despite `@playwright/test` being a dependency and an `e2e/` directory existing — it's currently empty.

Before opening a PR, the project convention is to run `npm test`, `npm run build`, and `npm run lint`.

## Architecture

### Core execution model

Every algorithm is an `AlgorithmRunner<TProblem, TState, THighlight, TResult>` (`src/types/algorithm.ts`) with `meta`, `pseudocode`, `validate(problem)`, `getInitialState(problem)`, and a `run(problem)` generator that yields `AlgorithmStep`s. Runners are pure and synchronous-generator-based; they don't know about React, routing, or storage.

- `src/algorithms/core/registry.ts` — a `Map`-backed registry (`registry.register(...)`) keyed by `meta.id`. Throws on duplicate IDs.
- `src/algorithms/core/engine.ts` — `ExecutionEngine` drains a runner's generator eagerly (`load`) or in yielding batches (`loadAsync`, for long-running stochastic algorithms), capping at `MAX_STEPS = 50_000` and marking `truncated` if exceeded. Supports step forward/backward/seek for replay.
- `src/store/execution.store.ts` — Zustand+immer store wrapping one `ExecutionEngine` instance; pages call `loadAlgorithm(runner, problem, options)` and drive playback (`play`, `pause`, `stepForward`, `seekToStep`, ...). `ExecutionLoadContext` (`pageKey`/`labKey`/`problemKey`) is used to decide whether to preserve the user's current viewer position across reloads (e.g. switching algorithm but not problem).
- `src/algorithms/register.ts` registers every runner into the global registry at startup.

### Categories and routing

`AlgorithmCategory` (`src/types/algorithm.ts`) is one of: `uninformed-search`, `informed-search`, `game-playing`, `local-search`, `planning`, `constraint-satisfaction`. Routes are category-specific and built centrally by `src/lib/buildRoute.ts`:

- Graph search: `/search/<category>/<algo>`
- Maze (treated as a game, but has its own page): `/maze/<algo>`
- Game-playing: `/play/<labId>/<algo>`
- Local search: `/local/<algo>?lab=<kind>`
- Planning: `/planning/<algo>` (lab id resolved internally)
- CSP: `/csp/<algo>` (lab id resolved internally)

Routes are declared in `src/router/index.tsx`, all pages are lazy-loaded. `src/lib/app-paths.ts` handles the Vite `base: '/Praxis'` deployment path (GitHub Pages) — use `toAppPath`/`toAbsoluteAppUrl` rather than hardcoding `/Praxis` anywhere.

### Module family pattern (read this before adding any algorithm, lab, or game)

This repo is organized around **registries + generic page shells**, not page-local conditionals. Each family (local-search labs, game-playing modules, maze, graph sandbox) defines a *module contract* — an object with `id`, `name`, `createDefaultProblem()`, `normalizeImportedProblem()`, render functions for each tab, etc. — and a generic page (`LocalSearchPage`, `GamePage`, ...) reads from the registry and delegates rendering. Page components must stay generic; domain-specific logic belongs in the family's `src/problems/<family>/` directory.

**`CONTRIBUTING.md` is the authoritative, detailed guide for this pattern** — it documents the exact contract shape, file list, and steps for each family (algorithms, local-search labs, game-playing modules, maze/graph-sandbox discovery entries) plus a blueprint for introducing an entirely new family. Read it before adding a new algorithm, lab, game, or discovery entry rather than inferring the pattern from one example file. Key things worth knowing up front:

- `src/lib/discovery-items.ts` is an *aggregator only* — it pulls discovery metadata from each family's own registry (`src/problems/<family>/labs.ts`). Don't add entries there directly.
- `docs/algorithm-template.md` and `docs/local-search-domain-template.md` are copy-paste starting points for new runners / local-search domains.
- Local-search lab contracts live in `src/problems/local-search/labs.ts` (registry) and `src/problems/local-search/lab-modules.tsx` (implementations); default problems come from `src/problems/local-search/presets.ts`.
- Game-playing module contracts live in `src/problems/game-playing/labs.ts` and `lab-modules.tsx`.
- `docs/local-search-roadmap.md` describes the planned end-state for the local-search family (full algorithm list, lab list, visualization tabs, trace-policy plans for combinatorial explosion). Treat it as a design doc/roadmap, not as current state — check the code before assuming something it describes has been built.

### Directory map

- `src/algorithms/<category>/` — runner implementations, grouped by category (`search/uninformed`, `search/informed`, `game-playing`, `local-search`, `planning`, `csp`). Each category folder typically has a `shared.ts`/`types.ts` with helpers and a `core.ts` with shared domain logic.
- `src/problems/<family>/` — problem domain models, registries (`labs.ts`), default-problem factories, and import/normalization logic, kept separate from algorithm logic.
- `src/pages/` — one generic page shell per family (`SearchPage`, `MazePage`, `GamePage`, `LocalSearchPage`, `PlanningPage`, `CspPage`).
- `src/visualizations/` — visualization adapters (`adapters/`, e.g. `graph-search.adapter.ts`, `game-tree.adapter.ts`) that translate algorithm state into renderable graph/tree structures, plus Cytoscape style definitions (`cytoscapeStyles/`).
- `src/components/module/` — generic, category-aware shared UI (e.g. `StatePanel.tsx`) used across all page shells. Don't add per-family branches here without checking `CONTRIBUTING.md`'s guidance on keeping shared rendering generic.
- `src/store/` — Zustand stores: `execution.store.ts` (algorithm playback), `editor.store.ts`/`maze.store.ts` (problem editing), `preferences.store.ts`, `comparison.store.ts`, `savedProblems.store.ts`.
- `src/types/` — shared contracts: `algorithm.ts` (`AlgorithmRunner`/`AlgorithmMeta`), `step.ts` (`AlgorithmStep`), `problem.ts` (problem domain types per family), `visualization.ts`.
- `public/problems/` and `src/lib/demo-manifest.ts` — bundled demo problems and the manifest describing them per category; `src/scripts/generate-manifest.cjs` regenerates `public/problems/graphs/_manifest.json` from the graph JSON files in that directory.

### Path alias

`@/*` maps to `src/*` (configured in both `tsconfig.json` and `vite.config.ts`). Use it instead of relative `../../..` imports.

## Testing

Tests live in `src/__tests__/`, run via Vitest with a `node` environment (not `jsdom` — see `vite.config.ts`). Useful anchors when adding new families/algorithms:

- `algorithms.test.ts` — runner registration and validation behavior.
- `build-route.test.ts` — route-building behavior.
- `lab-registries.test.ts` — discovery aggregation across families.
- `fixtures/local-search-builder.ts` — seeded fixture builder for local-search problems (`createLocalSearchFixtureBuilder`).

Stochastic algorithms (simulated annealing, GA, beam search, etc.) must accept a seeded RNG so tests stay deterministic — see `createSeededRandom` in `src/problems/local-search/n-queens.ts`, the seeded RNG used throughout `src/algorithms/local-search/`.
