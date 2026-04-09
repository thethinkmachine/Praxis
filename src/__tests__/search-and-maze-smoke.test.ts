import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerAllAlgorithms } from '@/algorithms/register';
import { registry } from '@/algorithms/core/registry';
import { buildMazeDemo, MAZE_DEMOS } from '@/problems/maze/demos';
import { mazeToGraphProblem } from '@/visualizations/adapters/maze.adapter';
import { Graph, type GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';

function runGeneratorWithGuard<TStep extends AlgorithmStep, TResult>(
  algorithmId: string,
  problem: unknown,
  maxSteps = 5000,
): { steps: TStep[]; result: TResult } {
  const entry = registry.get(algorithmId);
  if (!entry) throw new Error(`Algorithm "${algorithmId}" not registered`);

  const generator = entry.runner.run(problem);
  const steps: TStep[] = [];
  let count = 0;
  let next = generator.next();

  while (!next.done) {
    steps.push(next.value as TStep);
    count += 1;
    if (count > maxSteps) {
      throw new Error(`Algorithm "${algorithmId}" exceeded ${maxSteps} yielded steps`);
    }
    next = generator.next();
  }

  return { steps, result: next.value as TResult };
}

function loadRomaniaGraphProblem(): GraphProblem {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/problems/graphs/romania-map.json'), 'utf8'),
  ) as { problem: GraphProblem };

  return {
    ...raw.problem,
    graph: new Graph(raw.problem.graph),
    useHeuristic: true,
    heuristic: { id: 'manual-node' },
  };
}

beforeAll(() => {
  registerAllAlgorithms();
});

describe('Search page smoke', () => {
  const romania = loadRomaniaGraphProblem();

  it.each(['bfs', 'ucs', 'astar', 'weighted-astar', 'rbfs'] as const)(
    '%s terminates on the Romania demo',
    (algorithmId) => {
      const { steps } = runGeneratorWithGuard<AlgorithmStep, unknown>(algorithmId, romania, 2000);
      expect(steps.length).toBeGreaterThan(0);
      expect(['found', 'failed']).toContain(steps.at(-1)?.phase);
    },
  );
});

describe('Maze page smoke', () => {
  const mazeProblem = mazeToGraphProblem(buildMazeDemo(MAZE_DEMOS[0]));

  it.each(['bfs', 'astar', 'weighted-astar'] as const)(
    '%s terminates on the labyrinth maze demo',
    (algorithmId) => {
      const { steps } = runGeneratorWithGuard<AlgorithmStep, unknown>(algorithmId, mazeProblem, 4000);
      expect(steps.length).toBeGreaterThan(0);
      expect(['found', 'failed']).toContain(steps.at(-1)?.phase);
    },
  );
});
