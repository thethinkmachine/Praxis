# Local Search Expansion Roadmap

## Goal

Add a first-class `local-search` algorithm family to Praxis with the same level of rigor, polish, and replayability as the current graph-search and game-playing modules, while improving the platform's educational depth for users trying to understand how local search behaves on different landscapes and problem formulations.

This rollout must:

- be architecturally consistent with the existing runner + execution-engine + AlgorithmPage design
- avoid one-off labs with bespoke state handling
- make the differences between local-search algorithms visible, not just executable
- support both small pedagogical examples and larger configurable experiments
- stay honest about combinatorial explosion by using sampled or derived visualizations where exhaustive state-space rendering is misleading

## Scope

### Algorithms

The `local-search` family will include:

1. Random Search / Random Walk baseline
2. Simple Hill Climbing
3. Steepest-Ascent Hill Climbing
4. First-Choice Hill Climbing
5. Stochastic Hill Climbing
6. Hill Climbing with Sideways Moves
7. Random-Restart Hill Climbing
8. Simulated Annealing
9. Local Beam Search
10. Stochastic Beam Search
11. Tabu Search
12. Genetic Algorithm
13. Min-Conflicts

This is the target "comprehensive educational set" for the app. It is broad enough to cover deterministic, stochastic, memory-based, population-based, and repair-based local search without turning the category into an open-ended catalog of obscure variants.

### Labs / Problems

The local-search category will ship with these labs:

1. `N-Queens Lab`
2. `TSP / Route Lab`
3. `Graph Coloring Lab`
4. `Landscape Lab`
5. `N-Puzzle Lab`

### Important Note on `N-Puzzle`

`N-Puzzle` is not a standard flagship local-search problem in the same way `N-Queens`, `TSP`, or `Graph Coloring` are. It is classically taught under state-space search and heuristic search. However, it is still worth adding as a lab because:

- it gives users a familiar benchmark problem
- it lets us contrast path-based search with local search behavior
- some local-search variants can be illustrated on it via board scoring and neighborhood moves
- it expands educational value if framed correctly

For correctness and pedagogy, `N-Puzzle Lab` should be labeled as:

- a crossover lab that supports local-search-style experimentation
- not a claim that local search is the canonical or strongest way to solve the puzzle

## Educational Principles

Every local-search algorithm page and lab should help users answer these questions:

1. What is the state representation?
2. What is the objective / energy / fitness function?
3. What is the neighborhood operator?
4. How does the algorithm choose among neighbors?
5. What kinds of failure modes occur?
6. What does progress look like over time?
7. When and why does this algorithm outperform or underperform others?

The UI should consistently surface these concepts so the user does not have to infer them from raw trace output.

## Architectural Direction

### 1. Add `local-search` as a First-Class Category

Update category-level typing and taxonomy:

- `src/types/algorithm.ts`
- `src/types/problem.ts`
- `src/lib/constants.ts`
- `src/lib/buildRoute.ts`
- `src/lib/game-labs.ts`
- home taxonomy and sidebar/navigation surfaces

Result:

- Local Search appears beside Uninformed Search, Informed Search, and Game Playing
- algorithms become routable and discoverable via the same shared mechanisms

### 2. Introduce a General Local-Search Problem Model

The current app has strong support for graph problems, mazes, and Tic-Tac-Toe. Local search needs a separate, shared model.

Add a typed local-search problem family with subtypes such as:

- `NQueensProblem`
- `TspProblem`
- `GraphColoringProblem`
- `LandscapeProblem`
- `NPuzzleProblem`

Also define shared abstractions:

- state serializer / state key
- objective function
- neighborhood generator
- random initializer
- move descriptor
- optional feasibility / constraint violation evaluator

This should live under a dedicated local-search area rather than in generic graph/game folders.

### 3. Introduce Shared Local-Search Trace Types

The current `AlgorithmStep.metrics` shape is search-oriented:

- `nodesExpanded`
- `frontierSize`
- `currentDepth`
- `pathCost`

That is not sufficient for local search. We should extend the trace model so local-search runners can emit consistent educational metrics without abusing search terminology.

Add local-search state/metrics conventions such as:

- `currentScore`
- `bestScore`
- `acceptedMove`
- `candidateCount`
- `neighborsEvaluated`
- `plateauLength`
- `restartCount`
- `temperature`
- `beamWidth`
- `populationSize`
- `generation`
- `conflictCount`
- `stagnationSteps`

Implementation approach:

- extend `src/types/step.ts` so metrics can carry optional local-search fields
- define shared local-search trace state and highlight interfaces under `src/algorithms/local-search/types.ts`
- keep `AlgorithmStep` generic, but make state/metrics/category rendering smarter

### 4. Generalize the Right-Side State Panel

`src/components/module/StatePanel.tsx` is currently built mostly around frontier/explored/path semantics. That is acceptable for graph search, but local search requires category-specific rendering.

Refactor StatePanel into category-aware renderers:

- `SearchStatePanel`
- `GameStatePanel`
- `LocalSearchStatePanel`

The local-search panel should consistently show:

- current state summary
- best-so-far summary
- candidate move summary
- objective / cost / fitness breakdown
- restart / temperature / tabu / generation data when applicable

### 5. Add a Dedicated `LocalSearchPage`

Do not overload `SearchPage` or `GamePage`.

Add:

- `src/pages/LocalSearchPage.tsx`

This page should reuse `AlgorithmPage` but provide local-search-specific:

- problem configuration
- visualization tabs
- demo presets
- explanatory copy

### 6. Extend Visualization Adapters

The current visualization system already hints at where this should go:

- graph adapters for search
- tree adapters for explored structure
- grid adapter support in `src/types/visualization.ts`
- `LandscapeData` support already exists in the type layer

We should formalize local-search visualization adapters instead of embedding all rendering logic inside labs.

Planned adapter types:

1. `GridVisualizationAdapter`
   Used by `N-Queens`, `N-Puzzle`.

2. `GraphVisualizationAdapter`
   Used by `Graph Coloring`, possibly route overlay support for TSP.

3. `LandscapeVisualizationAdapter`
   Used by `Landscape Lab`, and optionally sampled objective projections for other problems.

4. `TrajectoryVisualizationAdapter`
   Used to render sampled state transitions and best-so-far evolution.

## Lab-by-Lab Design

### 1. N-Queens Lab

#### Why it matters

This should be the flagship local-search lab. It clearly demonstrates:

- local maxima
- plateaus
- ridges
- the power of random restart
- the effectiveness of min-conflicts

#### Representation

- one queen per column
- state represented by row positions per column
- objective shown as number of attacking pairs or number of conflicts

#### Customization

- board size `N`
- initial state mode: random or manual
- neighborhood operator: move one queen within a column
- restart count / restart policy
- sideways-move cap
- tabu tenure
- beam width
- population size / mutation rate / crossover type for GA
- random seed

#### Visualizations

- board grid with queens, attacked cells, and conflict overlays
- neighbor inspector showing top candidate moves
- objective trace over iterations
- restart markers on the timeline
- sampled state-trajectory graph

### 2. TSP / Route Lab

#### Why it matters

This is the best lab for teaching:

- neighborhood design matters
- local minima traps
- annealing's probabilistic escape behavior
- differences between greedy swaps and more global route edits

#### Representation

- state is a permutation of cities
- objective is route length

#### Customization

- city count
- random point generation
- manual city dragging
- preset maps
- distance metric
- move operator: swap, insert, 2-opt
- annealing schedule
- beam width
- tabu tenure
- GA parameters
- random seed

#### Visualizations

- route map with active route and best route
- edge delta preview for candidate moves
- route-length timeline
- move acceptance visualization
- population diversity summary for GA

### 3. Graph Coloring Lab

#### Why it matters

This shows local search on a constraint-satisfaction problem while reusing existing graph assets and editor ideas already present in the repo.

#### Representation

- graph nodes assigned colors
- objective is conflict count plus optional penalty shaping

#### Customization

- choose graph from presets or existing map data
- color count
- manual or random initialization
- penalty function variant
- tabu tenure
- restart strategy
- min-conflicts tie-breaking strategy
- random seed

#### Visualizations

- graph with conflict-highlighted nodes and edges
- color histogram
- conflicts-over-time chart
- neighbor move preview

### 4. Landscape Lab

#### Why it matters

This is the clearest way to explain:

- hill climbing
- stochasticity
- simulated annealing
- exploration vs exploitation

#### Representation

- 1D and 2D objective functions
- point or particle state on the surface

#### Customization

- preset objective function
- noise level
- step size
- temperature schedule
- random seed

#### Visualizations

- curve or surface plot
- current position and accepted moves
- best-so-far marker
- trajectory trace
- acceptance probability annotation

### 5. N-Puzzle Lab

#### Why it matters

This lab broadens educational depth by contrasting canonical heuristic search intuition with local-search-style objective optimization.

It must be framed carefully:

- "This lab explores local-search formulations of N-Puzzle"
- not "Local search is the standard best solver for N-Puzzle"

#### Representation

- board state as tile arrangement
- neighborhood from sliding legal tiles
- objective options:
  - misplaced tiles
  - Manhattan-distance sum
  - weighted heuristic score
  - inversion-aware custom score for experimentation

#### Recommended algorithms in this lab

- simple hill climbing
- steepest-ascent hill climbing
- stochastic hill climbing
- simulated annealing
- tabu search
- beam search variants
- GA only if the encoding and operators can be kept pedagogically honest

`Min-Conflicts` is not a good fit here and should not be forced into the lab.

#### Customization

- board size: 3x3 and 4x4 first
- preset scrambles
- random scramble depth
- objective function choice
- neighborhood policy
- annealing schedule
- tabu tenure
- beam width
- random seed

#### Visualizations

- puzzle board
- legal move candidates with score deltas
- heuristic / objective timeline
- local minimum and plateau indicators
- sampled trajectory panel

## Visualization Strategy

### Principle: Show Behavior, Not Just State

Local search is fundamentally about movement through an objective landscape. The app must therefore show:

- where the algorithm is now
- why it moved
- what alternatives it considered
- whether the move improved or worsened the objective
- how the best-so-far evolved

### Shared Tab Layout for Local Search

Each local-search page should use a consistent tab model:

1. `Problem View`
   Main board/map/graph/landscape.

2. `Neighborhood`
   Candidate moves and their scores, accepted/rejected status.

3. `Trajectory`
   Sampled state transitions, restart boundaries, best-so-far path.

4. `Objective`
   Score, conflicts, fitness, temperature, generation, diversity, etc. over time.

5. `State Space`
   A sampled and compressed state-space approximation when appropriate.

Not every lab needs every tab, but the structure should be stable.

### State-Space Visualization Policy

For local search, exhaustive state-space visualization is usually wrong or impractical. We should instead support:

- sampled trajectory graphs
- neighborhood snapshots
- elite-state archive views
- restart cluster visualization
- objective histograms
- population scatter views for GA

This is the correct answer to combinatorial explosion.

## Combinatorial Explosion Handling

The current execution engine precomputes every step and truncates after `10_000` steps in `src/algorithms/core/engine.ts`. That is acceptable for current search visualizations but will be restrictive for local search.

### Planned handling

1. Keep deterministic replay.
2. Add trace compression / sampling support for long-running local-search algorithms.
3. Distinguish:
   - full internal iteration count
   - rendered trace step count
4. Allow milestone recording:
   - every accepted move
   - every best-so-far update
   - every `k` iterations
   - every restart / generation / temperature stage

This preserves educational value without overwhelming the engine or UI.

### Proposed engine enhancement

Introduce a trace policy for runners:

- `full`
- `sampled`
- `milestones`

The execution engine should continue to operate on finite, replayable steps, but local-search runners should be allowed to emit compressed traces intentionally.

## Shared Local-Search Utilities

Create a shared utility layer under `src/algorithms/local-search/`:

- `types.ts`
- `shared.ts`
- `objective.ts`
- `neighbors.ts`
- `trace.ts`
- per-problem helper modules

This layer should provide:

- score formatting
- acceptance decision helpers
- restart bookkeeping
- candidate ranking helpers
- deterministic seeded randomness
- shared step creation helpers

Goal:

- algorithm files stay readable
- all local-search algorithms produce consistent descriptions, logs, and metrics

## Testing Strategy

The current test suite in `src/__tests__/algorithms.test.ts` only validates existing graph-search behavior. Local search needs stronger testing because many algorithms are stochastic.

### Deterministic test policy

Every stochastic local-search runner must accept a seeded RNG path so tests are stable.

### Tests to add

1. Registry tests
   - local-search algorithms register correctly

2. Validation tests
   - invalid problem shapes are rejected with clear messages

3. Invariant tests
   - N-Queens states always have one queen per column
   - TSP states remain valid permutations
   - Graph Coloring states use only allowed colors
   - N-Puzzle states stay solvable when required by generator logic

4. Trace tests
   - steps include consistent metrics
   - best-so-far never regresses incorrectly
   - restart counts and generation counts progress monotonically

5. Outcome tests
   - Min-Conflicts solves easy N-Queens cases
   - hill climbing improves objective on seeded fixtures
   - annealing can accept uphill moves when configured
   - tabu prevents immediate reversals under seeded fixtures

6. UI rendering smoke tests
   - core labs mount and render representative traces

## Rollout Phases

### Phase 1: Core Infrastructure

Deliverables:

- add `local-search` category and routing
- add typed local-search problem models
- add shared local-search trace types and helpers
- refactor StatePanel into category-aware rendering
- add `LocalSearchPage`
- add base visualization primitives for local-search tabs

Success criteria:

- app can host local-search algorithms as a first-class family
- at least one local-search runner can load and replay in the generic shell

### Phase 2: Flagship Lab and Core Algorithms

Deliverables:

- `N-Queens Lab`
- random search baseline
- simple / steepest / first-choice / stochastic hill climbing
- sideways moves
- random-restart hill climbing
- min-conflicts

Success criteria:

- users can compare hill-climbing family behavior on the same N-Queens setup
- restart and plateau behavior is visually obvious

### Phase 3: Stochastic and Memory-Based Search

Deliverables:

- simulated annealing
- tabu search
- local beam search
- stochastic beam search

Success criteria:

- users can see how non-greedy acceptance and multiple-state tracking change outcomes

### Phase 4: Population-Based Search

Deliverables:

- genetic algorithm infrastructure
- GA on N-Queens
- GA on TSP

Success criteria:

- population, fitness, crossover, mutation, and diversity are visualized coherently

### Phase 5: Additional Labs

Deliverables:

- `TSP / Route Lab`
- `Graph Coloring Lab`
- `Landscape Lab`
- `N-Puzzle Lab`

Success criteria:

- local-search family is no longer tied to one canonical problem
- users can transfer intuition across problem classes

### Phase 6: Comparison, Polish, and Documentation

Deliverables:

- cross-algorithm comparison presets
- shared scenario packs
- import/export for local-search problems
- refined pseudocode panels
- educational tooltips and algorithm notes
- docs updates and home-page surfacing

Success criteria:

- category feels integrated, not appended
- users can run meaningful side-by-side studies

## Consistency Rules During Implementation

To keep the rollout polished and coherent:

1. Every local-search algorithm must have:
   - metadata
   - pseudocode
   - validation
   - deterministic trace semantics
   - meaningful logs
   - educational metrics

2. Every lab must have:
   - presets
   - customization controls
   - a clear objective function display
   - at least one problem-centric visualization
   - at least one behavior-centric visualization

3. Every stochastic algorithm must support seeded runs.

4. Every visualization must degrade gracefully for larger problem sizes.

5. We do not fake exhaustive state-space views for huge combinatorial spaces.

## Recommended File Structure

Proposed additions:

- `src/algorithms/local-search/`
- `src/algorithms/local-search/types.ts`
- `src/algorithms/local-search/shared.ts`
- `src/algorithms/local-search/hill-climbing/`
- `src/algorithms/local-search/annealing/`
- `src/algorithms/local-search/beam/`
- `src/algorithms/local-search/tabu/`
- `src/algorithms/local-search/genetic/`
- `src/algorithms/local-search/min-conflicts/`
- `src/problems/local-search/`
- `src/pages/LocalSearchPage.tsx`
- `src/components/visualization/local-search/`
- `src/components/module/state-panels/`

## Definition of Done

The local-search expansion is complete when:

- the category is fully discoverable in the app
- all target algorithms are registered and replayable
- all five planned labs exist and feel consistent
- state, objective, and trajectory visualizations are present and polished
- tests cover deterministic invariants and seeded stochastic behavior
- educational framing is accurate, especially for `N-Puzzle Lab`

## Recommended Build Order

The implementation should proceed in this order:

1. Category + routing + shared types
2. State panel and metric refactor
3. `LocalSearchPage` shell
4. `N-Queens Lab`
5. hill-climbing family + min-conflicts
6. annealing + beam + tabu
7. GA infrastructure
8. `TSP / Route Lab`
9. `Graph Coloring Lab`
10. `Landscape Lab`
11. `N-Puzzle Lab`
12. comparison tooling, docs, and final polish

This order maximizes educational impact early while minimizing architectural rework later.
