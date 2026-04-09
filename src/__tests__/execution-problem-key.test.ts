import { describe, expect, it } from 'vitest';
import { Graph, type GraphProblem } from '@/types/problem';
import { createExecutionProblemKey, serializeExecutionProblem } from '@/lib/execution-problem-key';

describe('execution problem key', () => {
  it('is stable across equivalent graph problem shapes', () => {
    const first: GraphProblem = {
      graph: new Graph({
        directed: false,
        nodes: [{ id: 'B' }, { id: 'A' }],
        edges: [{ id: 'edge-1', source: 'A', target: 'B', weight: 1 }],
      }),
      startNode: 'A',
      goalNode: 'B',
      useHeuristic: true,
      heuristic: { id: 'zero' },
    };

    const second: GraphProblem = {
      goalNode: 'B',
      startNode: 'A',
      useHeuristic: true,
      heuristic: { id: 'zero' },
      graph: new Graph({
        edges: [{ id: 'edge-1', source: 'A', target: 'B', weight: 1 }],
        nodes: [{ id: 'A' }, { id: 'B' }],
        directed: false,
      }),
    };

    expect(serializeExecutionProblem(first)).toBe(serializeExecutionProblem(second));
    expect(createExecutionProblemKey(first)).toBe(createExecutionProblemKey(second));
  });

  it('changes when the execution input changes', () => {
    const base: GraphProblem = {
      graph: new Graph({
        directed: false,
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [{ id: 'edge-1', source: 'A', target: 'B', weight: 1 }],
      }),
      startNode: 'A',
      goalNode: 'B',
      useHeuristic: true,
      heuristic: { id: 'manhattan-distance', params: { scale: 1 } },
    };

    const weightedVariant: GraphProblem & { weight: number } = {
      ...base,
      weight: 1.5,
    };

    expect(createExecutionProblemKey(weightedVariant)).not.toBe(createExecutionProblemKey(base));
  });
});
