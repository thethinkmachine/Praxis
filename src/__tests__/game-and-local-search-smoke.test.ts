import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { registerAllAlgorithms } from '@/algorithms/register';
import { registry } from '@/algorithms/core/registry';
import { getTicTacToeScenario } from '@/problems/game-playing/tic-tac-toe-lab';
import type { AlgorithmStep } from '@/types/step';
import { Graph, type GraphProblem, type NQueensProblem } from '@/types/problem';
import { countConflicts } from '@/problems/local-search/n-queens';

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

beforeAll(() => {
  registerAllAlgorithms();
});

function loadRomaniaDemoProblem(): GraphProblem {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/problems/graphs/romania-map.json'), 'utf8'),
  ) as { problem: GraphProblem };

  return {
    ...raw.problem,
    graph: new Graph(raw.problem.graph),
  };
}

describe('Game-Playing Smoke', () => {
  const scenarioIds = ['forced-block', 'fork-trap', 'endgame-win'] as const;
  const algorithmIds = ['minimax', 'alpha-beta', 'negamax', 'sss-star'] as const;
  const samplingAlgorithmIds = ['expectimax', 'mcts'] as const;

  it.each(scenarioIds)('all game-playing algorithms agree on %s', (scenarioId) => {
    const problem = getTicTacToeScenario(scenarioId);
    const baseline = runGeneratorWithGuard<AlgorithmStep, { bestMove: number | null; bestScore: number }>(
      'minimax',
      problem,
    );

    expect(baseline.steps.length).toBeGreaterThan(0);
    expect(baseline.steps.at(-1)?.phase).toBe('found');

    for (const algorithmId of algorithmIds.slice(1)) {
      const candidate = runGeneratorWithGuard<AlgorithmStep, { bestMove: number | null; bestScore: number }>(
        algorithmId,
        problem,
      );

      expect(candidate.steps.length).toBeGreaterThan(0);
      expect(candidate.steps.at(-1)?.phase).toBe('found');
      expect(candidate.result.bestMove).toBe(baseline.result.bestMove);
      expect(candidate.result.bestScore).toBe(baseline.result.bestScore);
    }
  });

  it('alpha-beta expands no more nodes than minimax on the forced-block scenario', () => {
    const problem = getTicTacToeScenario('forced-block');
    const minimax = runGeneratorWithGuard<AlgorithmStep, { nodesExpanded: number }>('minimax', problem);
    const alphaBeta = runGeneratorWithGuard<AlgorithmStep, { nodesExpanded: number }>('alpha-beta', problem);

    expect(alphaBeta.result.nodesExpanded).toBeLessThanOrEqual(minimax.result.nodesExpanded);
  });

  it.each(samplingAlgorithmIds)('%s terminates on the forced-block scenario', (algorithmId) => {
    const problem = getTicTacToeScenario('forced-block');
    const { steps, result } = runGeneratorWithGuard<AlgorithmStep, { bestMove: number | null; bestScore: number }>(
      algorithmId,
      problem,
    );

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.at(-1)?.phase).toBe('found');
    expect(result.bestMove).toBe(2);
    expect(result.bestScore).toBeGreaterThan(0);
  });
});

describe('RBFS Regression', () => {
  it('RBFS terminates on the full Romania demo without an excessive trace', () => {
    const problem = loadRomaniaDemoProblem();
    const { steps } = runGeneratorWithGuard<AlgorithmStep, void>('rbfs', problem, 1500);
    const final = steps.at(-1);

    expect(final).toBeTruthy();
    expect(final?.phase).toBe('found');
    expect(steps.length).toBeLessThan(1500);
  });
});

describe('Local Search Smoke', () => {
  const nQueensProblem: NQueensProblem = {
    kind: 'n-queens',
    size: 8,
    initialState: [0, 0, 0, 0, 0, 0, 0, 0],
    maxSteps: 80,
    randomSeed: 1337,
    sidewaysMoveLimit: 10,
    restartLimit: 6,
    candidateSampleSize: 6,
    beamWidth: 4,
    tabuTenure: 7,
    populationSize: 16,
    mutationRate: 0.18,
    crossoverRate: 0.85,
    initialTemperature: 12,
    coolingRate: 0.94,
    constructionDepth: 4,
    pheromoneDecay: 0.25,
    pheromoneInfluence: 1.2,
    heuristicInfluence: 2,
    eliteWeight: 1.5,
  };

  const initialConflicts = countConflicts(nQueensProblem.initialState ?? []);

  const algorithmIds = [
    'random-walk',
    'hill-climbing-simple',
    'hill-climbing-steepest',
    'hill-climbing-first-choice',
    'hill-climbing-stochastic',
    'hill-climbing-sideways',
    'hill-climbing-random-restart',
    'simulated-annealing',
    'local-beam-search',
    'stochastic-beam-search',
    'tabu-search',
    'genetic-algorithm',
    'ant-colony-optimization',
    'min-conflicts',
  ] as const;

  it.each(algorithmIds)('%s terminates and returns a valid result', (algorithmId) => {
    const { steps, result } = runGeneratorWithGuard<
      AlgorithmStep,
      { bestValue: number; bestState: unknown; iterations: number; solved: boolean }
    >(algorithmId, nQueensProblem);

    expect(steps.length).toBeGreaterThan(0);
    expect(['found', 'failed']).toContain(steps.at(-1)?.phase);
    expect(Number.isFinite(result.bestValue)).toBe(true);
    expect(result.bestState).toBeTruthy();
    expect(result.iterations).toBeGreaterThanOrEqual(0);
    expect(typeof result.solved).toBe('boolean');
  });

  it('seeded local-search runners do not regress past the initial 8-queens conflict count, except random walk', () => {
    for (const algorithmId of algorithmIds.filter((id) => id !== 'random-walk')) {
      const { result } = runGeneratorWithGuard<AlgorithmStep, { bestValue: number }>(algorithmId, nQueensProblem);
      expect(result.bestValue).toBeLessThanOrEqual(initialConflicts);
    }
  });
});
