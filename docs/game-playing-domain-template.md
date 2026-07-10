# Game-Playing Domain Template

Use this when adding a new game-playing state representation so the work is split into three layers instead of being buried inside the six algorithm runners. This is for adding a new *domain* (a new kind of state the existing Minimax/Alpha-Beta/Negamax/SSS*/Expectimax/MCTS runners should operate on) — for a new *concrete game* with its own board UI, see the "Adding A New Game-Playing Module" section of `CONTRIBUTING.md` instead.

## 1. Domain implementation

Create a problem type and domain under `src/problems/game-playing/`.

```ts
import type { GameDomain } from '@/problems/game-playing/domain';

export interface ExampleGameProblem {
  kind: 'example-game';
  // ... whatever fully describes a position
}

export interface ExampleGameState {
  // ... whatever a runner needs to inspect a single position
}

export const exampleGameDomain: GameDomain<ExampleGameProblem, ExampleGameState> = {
  kind: 'example-game',
  validate(problem) {
    return { valid: true, errors: [] };
  },
  initialState(problem) {
    return {} as ExampleGameState;
  },
  stateId(problem, state) {
    return JSON.stringify(state); // any stable identity works
  },
  nodeKind(problem, state) {
    return 'max'; // 'max' | 'min' | 'chance' | 'terminal'
  },
  isTerminal(problem, state) {
    return false;
  },
  legalMoves(problem, state) {
    return []; // [{ id, label, probability? }]
  },
  applyMove(problem, state, moveId) {
    return state;
  },
  terminalValue(problem, state, depth) {
    return 0; // fixed MAX-perspective utility, only meaningful when isTerminal is true
  },
  describeState(problem, state) {
    return 'Describe the state here';
  },
};
```

## 2. Register the domain

```ts
// src/problems/game-playing/domains.ts
export function resolveGameDomain(problem: GameProblem): GameDomain<GameProblem, unknown> {
  if (problem.kind === 'example-game') return exampleGameDomain as unknown as GameDomain<GameProblem, unknown>;
  return gameTreeDomain as unknown as GameDomain<GameProblem, unknown>;
}
```

That's it for the algorithm side — all six runners already dispatch through `resolveGameDomain(problem)`, so they immediately work on the new domain. If your domain's states can be `'chance'`-kind, note that Negamax and SSS* will reject it (their `validate()` rejects any chance node — see `CONTRIBUTING.md`'s "Important Rule" in the game-playing-domain section for why); Minimax, Alpha-Beta, Expectimax, and MCTS all handle it.

## 3. Lab module skeleton

Register a lab in `src/problems/game-playing/lab-modules.tsx` (following the `GamePlayingLabModule` contract — `createDefaultProblem`, `normalizeImportedProblem`, `presets`, `loadPreset`, `renderConfigPanel`, `renderTabs`, `renderTitleActions`) so users can actually set up and edit this domain's problems, exactly like the "Adding A New Game-Playing Module" section describes. The Custom Tree lab (`src/problems/game-playing/custom-tree-lab-module.tsx`) is a complete worked example: it hydrates a Zustand editor store from `context.problem` on load, pushes edits back via `context.setProblem`/`context.markProblemChanged`, and switches between an interactive editor (pre-run) and a read-only, algorithm-annotated view (`context.currentIndex > 0`).

## 4. Tests

Use `src/__tests__/fixtures/game-tree-builder.ts`'s pattern (a compact nested-literal tree builder) as inspiration if your domain has hierarchical structure, or write a similar small builder for your own domain's shape. See `src/__tests__/game-tree-domain.test.ts` for the kind of coverage expected: cross-algorithm agreement on a hand-computed case, a pruning/efficiency assertion, and `validate()` edge cases.

## Checklist

1. Add the new problem kind to `src/types/problem.ts` and widen the `GameProblem` union.
2. Implement the `GameDomain` in `src/problems/game-playing/<name>.domain.ts`.
3. Register it in `src/problems/game-playing/domains.ts`.
4. Add the lab module (`lab-modules.tsx` + `labs.ts`) so the domain has an editable UI.
5. Add at least one test that runs a hand-computed case through several algorithms and checks `validate()`'s edge cases.
