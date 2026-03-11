# Algorithm Template

Use this checklist when adding a new algorithm runner.

## File Shape

```ts
import type { AlgorithmRunner } from '@/types';

export const exampleRunner: AlgorithmRunner<ExampleProblem, ExampleState, ExampleHighlight, ExampleResult> = {
  meta: {
    id: 'example-id',
    name: 'Example Algorithm',
    category: 'local-search',
    description: 'One-line summary.',
    timeComplexity: 'Depends',
    spaceComplexity: 'Depends',
    complete: false,
    optimal: false,
    tags: ['example'],
    bookChapter: 'TBD',
  },
  pseudocode: [
    'Initialize state',
    'Repeat until termination',
    'Return best result',
  ],
  validate(problem) {
    return { valid: true, errors: [] };
  },
  getInitialState(problem) {
    return {} as ExampleState;
  },
  *run(problem) {
    yield {
      stepNumber: 1,
      phase: 'init',
      description: 'Initial state',
      pseudocodeLine: 0,
      state: {} as ExampleState,
      highlight: {} as ExampleHighlight,
      metrics: {},
    };

    return {} as ExampleResult;
  },
};
```

## Checklist

1. Add the runner file.
2. Register it in `src/algorithms/register.ts`.
3. Verify its category routes correctly.
4. Add a test in `src/__tests__/algorithms.test.ts`.
5. Add related metadata if it belongs to a new lab or problem family.