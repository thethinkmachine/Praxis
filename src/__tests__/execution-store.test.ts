import { beforeEach, describe, expect, it } from 'vitest';
import type { AlgorithmRunner, AlgorithmStep } from '@/types';
import { useExecutionStore, type ExecutionLoadContext } from '@/store/execution.store';

interface MockProblem {
  totalSteps: number;
}

function createMockRunner(id = 'mock-search'): AlgorithmRunner<MockProblem, { value: number }, null, void> {
  return {
    meta: {
      id,
      name: 'Mock Search',
      category: 'uninformed-search',
      description: 'Test runner',
      timeComplexity: 'O(1)',
      spaceComplexity: 'O(1)',
      complete: true,
      optimal: true,
      tags: ['test'],
      bookChapter: 'N/A',
    },
    pseudocode: ['mock'],
    validate: () => ({ valid: true, errors: [], warnings: [] }),
    getInitialState: () => ({ value: 0 }),
    *run(problem): Generator<AlgorithmStep<{ value: number }, null>, void, void> {
      for (let index = 0; index < problem.totalSteps; index += 1) {
        yield {
          stepNumber: index,
          phase: index === problem.totalSteps - 1 ? 'found' : 'visiting',
          description: `step ${index}`,
          state: { value: index },
          highlight: null,
          pseudocodeLine: 0,
          metrics: [],
        };
      }
    },
  };
}

async function loadWithContext(context: ExecutionLoadContext) {
  await useExecutionStore.getState().loadAlgorithm(
    createMockRunner(),
    { totalSteps: 4 },
    { algorithmId: 'mock-search', context },
  );
}

describe('execution store load context', () => {
  beforeEach(() => {
    useExecutionStore.getState().clear();
  });

  it('preserves viewer position for the same algorithm and context when asked to', async () => {
    const context = {
      pageKey: 'search',
      labKey: 'uninformed-search',
      problemKey: 'workspace-a',
      preservePosition: true,
    } satisfies ExecutionLoadContext;

    await loadWithContext(context);
    useExecutionStore.getState().seekToStep(2);
    await loadWithContext(context);

    expect(useExecutionStore.getState().currentIndex).toBe(2);
  });

  it('resets the trace when the problem key changes', async () => {
    await loadWithContext({
      pageKey: 'search',
      labKey: 'uninformed-search',
      problemKey: 'workspace-a',
      preservePosition: true,
    });
    useExecutionStore.getState().seekToStep(2);

    await loadWithContext({
      pageKey: 'search',
      labKey: 'uninformed-search',
      problemKey: 'workspace-b',
      preservePosition: true,
    });

    expect(useExecutionStore.getState().currentIndex).toBe(0);
  });

  it('resets the trace when the page context changes', async () => {
    await loadWithContext({
      pageKey: 'search',
      labKey: 'uninformed-search',
      problemKey: 'shared-problem',
      preservePosition: true,
    });
    useExecutionStore.getState().seekToStep(2);

    await loadWithContext({
      pageKey: 'maze',
      labKey: 'maze',
      problemKey: 'shared-problem',
      preservePosition: true,
    });

    expect(useExecutionStore.getState().currentIndex).toBe(0);
  });
});
