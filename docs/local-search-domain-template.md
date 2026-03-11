# Local Search Domain Template

Use this when adding a new local-search problem kind so the work is split into three layers instead of being buried inside `LocalSearchPage`.

## 1. Domain implementation

Create a problem type, domain, and defaults under `src/problems/local-search/`.

```ts
import type { LocalSearchDomain } from '@/problems/local-search/types';

export interface ExampleProblem {
  kind: 'example-kind';
  randomSeed?: number;
  maxSteps?: number;
}

export const exampleDomain: LocalSearchDomain<any, any> = {
  kind: 'example-kind',
  label: 'Example Domain',
  objectiveLabel: 'Objective',
  objectiveGoal: 'minimize',
  stateLabel: 'State',
  validate(problem) {
    return { valid: true, errors: [] };
  },
  createRandomState(problem, random) {
    return {};
  },
  normalizeState(problem, random) {
    return this.createRandomState(problem, random);
  },
  evaluate(problem, state) {
    return {
      score: 0,
      value: 0,
      displayValue: '0',
      goalReached: false,
      summary: 'Describe the current state.',
    };
  },
  getNeighbors(problem, state, random) {
    return [];
  },
  serializeState(problem, state) {
    return JSON.stringify(state);
  },
  describeState(problem, state) {
    return 'Describe the state here';
  },
};
```

## 2. Lab module skeleton

Register the lab in `src/problems/local-search/lab-modules.tsx` using a module object instead of editing `LocalSearchPage`.

```tsx
{
  id: 'example-kind',
  name: 'Example Lab',
  description: 'Explain what the lab teaches.',
  defaultAlgorithmId: 'hill-climbing-steepest',
  path: '/local/hill-climbing-steepest?lab=example-kind',
  createDefaultProblem: () => createDefaultExampleProblem(),
  normalizeImportedProblem(problem: unknown) {
    const incoming = problem as ExampleProblem;
    return { ...createDefaultExampleProblem(), ...incoming, kind: 'example-kind' };
  },
  randomizeProblem(problem) {
    return { ...problem, randomSeed: (problem.randomSeed ?? 1337) + 17 };
  },
  renderSetupSection(context) {
    return (
      <ConfigSection title="Example Setup">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Example Control</p>
      </ConfigSection>
    );
  },
  renderBoardTab(context) {
    return withOverlay(<ExampleBoardTab problem={context.problem as ExampleProblem} step={context.step} />, context);
  },
  renderNeighborhoodTab(context) {
    return withOverlay(<ExampleNeighborhoodTab problem={context.problem as ExampleProblem} step={context.step} />, context);
  },
}
```

## 3. Test fixture builder

Use `src/__tests__/fixtures/local-search-builder.ts` to keep seeded fixtures compact and repeatable.

```ts
import { createLocalSearchFixtureBuilder } from '@/__tests__/fixtures/local-search-builder';

const buildExampleProblem = createLocalSearchFixtureBuilder({
  kind: 'example-kind',
  randomSeed: 1337,
  maxSteps: 80,
});

const exampleProblem = buildExampleProblem({
  maxSteps: 120,
});
```

## Checklist

1. Add the new problem kind to `src/types/problem.ts`.
2. Register the domain in `src/problems/local-search/domains.ts`.
3. Add the lab module in `src/problems/local-search/lab-modules.tsx`.
4. Add defaults in `src/problems/local-search/presets.ts`.
5. Add at least one seeded test using the fixture builder.