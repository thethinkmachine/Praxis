# Contributing to Praxis

Praxis is easiest to extend when new algorithms, games, labs, and sandboxes are added through registries and module contracts rather than by growing page-local `switch` logic.

This guide is written for an outside contributor who wants to add something new without already knowing the internal structure. It shows the current family patterns, and it also includes a short blueprint for introducing a genuinely new family if the existing ones do not fit.

## Scope And Limitations

This guide covers the families that currently exist in the repo:

1. Algorithm runners.
2. Local-search labs.
3. Game-playing modules.
4. Maze Game and Graph Sandbox discovery entries.

If you are adding a completely new family, use the new-family blueprint below first. The existing family sections still help, but they are examples rather than a complete recipe for a brand-new subsystem.

The current UI assumes steps can be rendered through shared panels, metrics, and generic pages. If a new family needs a different page shell or route shape, add that shell explicitly instead of forcing it into an unrelated contract.

## Core Principles

1. Prefer registries over scattered conditionals.
2. Keep problem defaults in factory functions, not inline component state.
3. Keep page components generic. Domain-specific setup and rendering should live in lab or module definitions.
4. Treat routing, discovery metadata, and rendering logic as separate concerns.
5. Add tests for the happy path and at least one validation or failure case when practical.

## Quick Start

If you are unsure where your change belongs, start here:

1. Adding a new algorithm to an existing family: use [Adding A New Algorithm](#adding-a-new-algorithm).
2. Adding a new local-search lab: use [Adding A New Local Search Lab](#adding-a-new-local-search-lab).
3. Adding a new game-playing module: use [Adding A New Game-Playing Module](#adding-a-new-game-playing-module).
4. Adding or changing Maze / Graph Sandbox discovery: use the Maze or Graph Sandbox sections.
5. Adding a brand-new family: use [New Family Blueprint](#new-family-blueprint) and then adapt the closest existing pattern.

## Terminology

Praxis now distinguishes between several kinds of interactive modules:

1. `Algorithm`: a runnable algorithm implementation such as BFS, A*, Minimax, or Simulated Annealing.
2. `Game`: an interactive problem module with game-specific rendering and controls, such as Tic-Tac-Toe or Maze Game.
3. `Sandbox`: a general-purpose experimentation surface, such as Graph Sandbox.
4. `Lab`: a structured educational module, currently used most heavily in local search.
5. `Discovery item`: any surfaced module shown on the home Playgrounds tab or in module search.

## Architecture Map

### Algorithms

- Registry: `src/algorithms/register.ts`
- Runtime registry implementation: `src/algorithms/core/registry.ts`
- Route builder: `src/lib/buildRoute.ts`
- Algorithm tests: `src/__tests__/algorithms.test.ts`

### Local Search Labs

- Local-search page shell: `src/pages/LocalSearchPage.tsx`
- Local-search lab registry and helpers: `src/problems/local-search/labs.ts`
- Local-search lab modules: `src/problems/local-search/lab-modules.tsx`
- Default problem factories: `src/problems/local-search/presets.ts`
- Template: `docs/local-search-domain-template.md`
- Test fixture builder: `src/__tests__/fixtures/local-search-builder.ts`

### Game-Playing Modules

- Game page shell: `src/pages/GamePage.tsx`
- Game lab registry: `src/problems/game-playing/labs.ts`
- Game lab modules: `src/problems/game-playing/lab-modules.tsx`
- Example game metadata: `src/problems/game-playing/tic-tac-toe-lab.ts`

### Maze Game And Graph Sandbox Discovery

- Maze discovery entries: `src/problems/maze/labs.ts`
- Graph Sandbox discovery entries: `src/problems/search/labs.ts`
- Home/search discovery aggregation: `src/lib/discovery-items.ts`

### State Panel Behavior

- Graph/search, local-search, and game-playing algorithms should populate `step.statePanels` in their shared trace helpers or runners.
- `src/components/module/StatePanel.tsx` now renders those panels directly and should stay generic.
- If you introduce a new algorithm family, add its state-panel generation at the algorithm layer instead of adding category branches to the UI.

## New Family Blueprint

Use this when the current families are not a good fit.

1. Create a new source registry for the family, not just a page component.
2. Define a generic page shell for the family that reads from the registry and delegates rendering.
3. Decide the route shape up front and make it unique enough to disambiguate modules.
4. Put discovery metadata in the family-specific registry, not in the aggregator.
5. Add tests for registration, routing, and the family-specific data contract.
6. Keep shared rendering generic so the page does not become a pile of family-specific branches.

Example:

- If you were adding a new "planning" family, you would likely create `src/problems/planning/`, a planning page shell, a planning registry, a route entry in `src/lib/buildRoute.ts`, and tests for the registry and route behavior.
- If the new family can reuse an existing shell, do that instead of creating another page.

## Before You Start

Decide what kind of contribution you are making.

1. New algorithm, existing module.
2. New local-search lab or problem kind.
3. New game-playing module.
4. New discovery entry for Maze Game or Graph Sandbox.
5. Cross-cutting route or UI metadata change.

If your feature requires editing a page component directly, stop and check whether it should instead be expressed through a registry or module definition.

## Adding A New Algorithm

Use this path when the problem surface already exists and you are only adding another algorithm to run on it.

Example: adding another graph-search algorithm such as a new heuristic variant belongs here. If the new algorithm family is unrelated to graph search, use the new-family blueprint first.

### Files You Will Usually Touch

1. `src/algorithms/<category>/...`
2. `src/algorithms/register.ts`
3. `src/__tests__/algorithms.test.ts`
4. Optionally `src/lib/buildRoute.ts` if you introduce a truly new route pattern

### Required Runner Shape

Each algorithm should implement the `AlgorithmRunner` contract with:

1. `meta`
2. `pseudocode`
3. `validate(problem)`
4. `getInitialState(problem)`
5. `run(problem)`

Use `docs/algorithm-template.md` as the starting point.

### Steps

1. Create the runner in the matching category folder under `src/algorithms/`.
2. Fill in complete `meta` information, including `id`, `name`, `category`, complexity fields, and tags.
3. Make sure validation errors are useful to end users.
4. Register the runner in `src/algorithms/register.ts`.
5. Confirm the runner’s category resolves to the expected route via `src/lib/buildRoute.ts`.
6. Add tests in `src/__tests__/algorithms.test.ts`.

### What This Section Is Good For

1. Reusing the current runner contract.
2. Keeping the page shell unchanged.
3. Adding algorithm variants inside the existing algorithm families.

### What This Section Does Not Cover

1. Creating a brand-new algorithm page or registry.
2. Designing a new route family from scratch.
3. Replacing the existing runner contract with something unrelated.

### References

1. Graph search: `src/algorithms/search/`
2. Local search: `src/algorithms/local-search/`
3. Game playing: `src/algorithms/game-playing/`

## Adding A New Local Search Lab

Use this path when you are adding a new local-search problem kind such as a new CSP, optimization problem, or visual landscape.

Example: adding a new TSP variation, a new N-Queens variant, or a new landscape domain belongs here.

### Files You Will Usually Touch

1. `src/types/problem.ts`
2. `src/problems/local-search/...`
3. `src/problems/local-search/presets.ts`
4. `src/problems/local-search/lab-modules.tsx`
5. `src/problems/local-search/labs.ts`
6. `src/__tests__/fixtures/local-search-builder.ts`
7. A new test file or `src/__tests__/algorithms.test.ts`

### The Local Search Contract

The local-search page is generic. It expects each lab to provide:

1. `id`
2. `name`
3. `description`
4. `defaultAlgorithmId`
5. `path`
6. `createDefaultProblem()`
7. `normalizeImportedProblem(problem)`
8. `randomizeProblem(problem)`
9. `renderSetupSection(context)`
10. `renderBoardTab(context)`
11. `renderNeighborhoodTab(context)`

These are defined in `src/problems/local-search/labs.ts` and implemented in `src/problems/local-search/lab-modules.tsx`.

### Steps

1. Add the problem type to `src/types/problem.ts`.
2. Add any domain logic, helpers, and serializers under `src/problems/local-search/`.
3. Add a default problem factory in `src/problems/local-search/presets.ts`.
4. Register a module object in `src/problems/local-search/lab-modules.tsx`.
5. Make sure its `path` points to a local-search route such as `/local/<algorithm>?lab=<kind>`.
6. Add seeded fixtures with `src/__tests__/fixtures/local-search-builder.ts` if the domain benefits from compact, repeatable setup.
7. Add tests.

### Important Rule

Do not add lab-specific rendering branches to `src/pages/LocalSearchPage.tsx`. That page should stay generic.

### Template

Use `docs/local-search-domain-template.md` as the canonical starter template.

### What This Section Is Good For

1. Adding a new problem kind to the local-search family.
2. Reusing the generic `LocalSearchPage` shell.
3. Keeping domain logic isolated from the page component.

### What This Section Does Not Cover

1. Introducing a new top-level family unrelated to local search.
2. Replacing the generic page with domain-specific branches.
3. Moving lab discovery into `LocalSearchPage`.

## Adding A New Game-Playing Module

Use this path when you are adding a new adversarial game such as Connect Four.

Example: adding a new Tic-Tac-Toe-like or Connect Four-like game belongs here. If the family is not an adversarial board game, use the new-family blueprint first.

### Files You Will Usually Touch

1. `src/types/problem.ts`
2. `src/problems/game-playing/...`
3. `src/problems/game-playing/lab-modules.tsx`
4. `src/problems/game-playing/labs.ts`
5. A visualization component under `src/components/visualization/`
6. Tests for problem normalization, routes, or discovery if needed

### The Game Module Contract

The game page is generic. Each game module should provide:

1. `id`
2. `name`
3. `description`
4. `defaultAlgorithmId`
5. `path`
6. `createDefaultProblem()`
7. `normalizeImportedProblem(problem)`
8. `presets`
9. `loadPreset(presetId)`
10. `renderConfigPanel(context)`
11. `renderTabs(context)`
12. `renderTitleActions(context)`

These contracts live in `src/problems/game-playing/lab-modules.tsx` and `src/problems/game-playing/labs.ts`.

### Steps

1. Add or extend the game problem type in `src/types/problem.ts`.
2. Create problem helpers, presets, and normalization logic under `src/problems/game-playing/`.
3. Implement the module in `src/problems/game-playing/lab-modules.tsx`.
4. Ensure `src/problems/game-playing/labs.ts` exposes the new registry metadata.
5. Keep the route in the form `/play/:labId/:algo`.
6. Keep all game-specific rendering out of `src/pages/GamePage.tsx`; that page should only resolve the active game and delegate.

### Important Rules

1. Do not hardcode a new game into `src/pages/GamePage.tsx`.
2. Do not overload the route shape with game-specific parameters if the lab id already disambiguates the module.
3. If multiple games share the same algorithms, reuse the same `game-playing` algorithm category and let the route identify the active game module.

### What This Section Is Good For

1. Adding a new adversarial game module.
2. Reusing the generic `GamePage` shell.
3. Wiring a new game into the existing route and discovery flow.

### What This Section Does Not Cover

1. Building a non-game family.
2. Hardcoding game logic into the page component.
3. Introducing another route pattern when the lab id already works.

## Adding Or Updating Maze Game Entries

Maze is treated as a game surfaced in the discovery layer, but it currently still uses its own dedicated page implementation.

### Files You Will Usually Touch

1. `src/problems/maze/labs.ts`
2. Optionally `src/pages/MazePage.tsx`
3. Optionally maze data or demo files under `src/problems/maze/`

### Use This When

1. You want to change Maze Game naming, descriptions, or default algorithms.
2. You want to add a new discovery entry for another Maze Game launch point.
3. You want to add or change Maze demos.

### Important Rule

Do not edit `src/lib/discovery-items.ts` directly for Maze-specific entries. Register them in `src/problems/maze/labs.ts` and let the aggregator pick them up.

### What This Section Is Good For

1. Tweaking Maze launch points and discovery metadata.
2. Keeping Maze registration in the Maze registry.
3. Avoiding duplicate discovery records.

### What This Section Does Not Cover

1. Creating a new Maze page shell.
2. Changing discovery logic in the aggregator first.

## Adding Or Updating Graph Sandbox Entries

Graph Sandbox is the general-purpose graph experimentation interface for search algorithms. It is not a game.

### Files You Will Usually Touch

1. `src/problems/search/labs.ts`
2. Optionally `src/pages/SearchPage.tsx`
3. Optionally graph demo data under `public/problems/graphs/`

### Use This When

1. You want a new discovery entry with a different default algorithm.
2. You want to adjust how Graph Sandbox is described in home search/discovery.
3. You want to add graph problem presets or demos.

### Important Rule

Do not edit `src/lib/discovery-items.ts` directly for Graph Sandbox-specific entries. Register them in `src/problems/search/labs.ts`.

### What This Section Is Good For

1. Adding or renaming Graph Sandbox launch points.
2. Keeping graph discovery data in the search registry.
3. Reusing the existing sandbox shell.

### What This Section Does Not Cover

1. A separate graph family with a different page shell.
2. Discovery entries that should live in another registry.

## Updating Home Discovery Metadata

`src/lib/discovery-items.ts` is an aggregator, not the source of truth for individual modules.

It assembles:

1. Maze Game entries from `src/problems/maze/labs.ts`
2. Graph Sandbox entries from `src/problems/search/labs.ts`
3. Game-playing modules from `src/problems/game-playing/labs.ts`
4. Local-search modules from `src/problems/local-search/labs.ts`

If you find yourself adding individual items directly inside `src/lib/discovery-items.ts`, you are probably editing the wrong file.

## Contributor-Friendly Checklist

Before you open a PR, ask yourself:

1. Did I add the feature to a registry instead of hardcoding it in a page?
2. Did I keep the page shell generic?
3. Did I update route, discovery, and tests together if the feature affects all three?
4. If this is a new family, did I create a registry and shell before adding details?
5. Would an outside developer be able to find the file to change from this guide alone?

## Routing Rules

Routes are intentionally category-specific.

1. Graph search algorithms: `/search/<category>/<algo>`
2. Maze Game: `/maze/<algo>`
3. Game-playing modules: `/play/<labId>/<algo>`
4. Local-search modules: `/local/<algo>?lab=<kind>`

The route builder is `src/lib/buildRoute.ts`.

When introducing a new module, verify that:

1. Discovery metadata points to the correct route.
2. Algorithm switchers preserve the current module context where expected.
3. Existing links and bookmarks are not silently broken.

## Validation Checklist

Before opening a PR, run:

```bash
npm test
npm build
npm lint
```

At minimum, verify:

1. The new module or algorithm can be reached from the intended route.
2. Algorithm switching keeps the right context.
3. Import/export still normalizes problems correctly.
4. Demo or preset loading works.
5. Discovery/home tiles and search results show the new item with the right name and description.

## Testing Guidance

Use the existing test files as anchors:

1. `src/__tests__/algorithms.test.ts` for registration and validation behavior.
2. `src/__tests__/build-route.test.ts` for route behavior.
3. `src/__tests__/lab-registries.test.ts` for discovery aggregation.

If you add a new domain with custom normalization or fixture logic, prefer a focused dedicated test file over making a single giant shared test harder to maintain.

## Common Mistakes To Avoid

1. Adding page-level `switch` branches instead of a module definition.
2. Putting source metadata into the aggregator instead of the source registry.
3. Hardcoding default problem objects directly in React state.
4. Forgetting to normalize imported problems.
5. Reusing a route shape that cannot disambiguate two modules sharing the same algorithm.
6. Renaming surfaced modules without updating home discovery or search copy.

## Suggested Workflow For Contributors

1. Decide the contribution type.
2. Find the source registry for that type.
3. Add the implementation behind the registry.
4. Register the new item.
5. Validate route, discovery, and tests.
6. Update docs if the extension pattern changed.

## Quick Decision Guide

If you are unsure where to add something, use this map:

1. New BFS variant on graphs: `src/algorithms/search/` and `src/algorithms/register.ts`
2. New local-search problem kind: `src/problems/local-search/` plus `src/problems/local-search/lab-modules.tsx`
3. New adversarial game like Connect Four: `src/problems/game-playing/` plus `src/problems/game-playing/lab-modules.tsx`
4. New Maze Game launch point: `src/problems/maze/labs.ts`
5. New Graph Sandbox launch point: `src/problems/search/labs.ts`
6. New family with its own shell: create a family registry, shell, and route first, then add the module or lab files.

When in doubt, follow the existing module contracts and keep the pages generic.