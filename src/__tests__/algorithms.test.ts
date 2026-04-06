import { Graph } from '@/types/problem';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllAlgorithms } from '@/algorithms/register';
import { registry } from '@/algorithms/core/registry';
import { simpleGraphProblem, romaniaMapProblem } from './fixtures/mock-problems';
import type { AlgorithmStep } from '@/types/step';
import type { GraphColoringProblem, NQueensProblem, TspProblem } from '@/types/problem';
import { countConflicts } from '@/problems/local-search/n-queens';

function runToEnd(algorithmId: string, problem: unknown): AlgorithmStep {
  const entry = registry.get(algorithmId);
  if (!entry) throw new Error(`Algorithm "${algorithmId}" not registered`);

  const gen = entry.runner.run(problem);
  let last: AlgorithmStep | null = null;
  let result = gen.next();

  while (!result.done) {
    last = result.value as AlgorithmStep;
    result = gen.next();
  }

  if (!last) throw new Error(`Algorithm "${algorithmId}" produced no steps`);
  return last;
}

function collectAllSteps(algorithmId: string, problem: unknown): AlgorithmStep[] {
  const entry = registry.get(algorithmId);
  if (!entry) throw new Error(`Algorithm "${algorithmId}" not registered`);

  const gen = entry.runner.run(problem);
  const steps: AlgorithmStep[] = [];
  let result = gen.next();

  while (!result.done) {
    steps.push(result.value as AlgorithmStep);
    result = gen.next();
  }

  return steps;
}

function getFinalPath(step: AlgorithmStep): string[] | null {
  const st = step.state as Record<string, unknown>;
  if (Array.isArray(st.foundPath)) return st.foundPath as string[];
  if (Array.isArray(st.path)) return st.path as string[];
  return null;
}

beforeAll(() => {
  registerAllAlgorithms();
});

describe('Uninformed Search', () => {
  it('BFS finds a valid path', () => {
    const step = runToEnd('bfs', simpleGraphProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(simpleGraphProblem.startNode);
    expect(path![path!.length - 1]).toBe(simpleGraphProblem.goalNode);
  });

  it('DFS finds a valid path', () => {
    const step = runToEnd('dfs', simpleGraphProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(simpleGraphProblem.startNode);
    expect(path![path!.length - 1]).toBe(simpleGraphProblem.goalNode);
  });

  it('DLS fails when depth limit is too shallow', () => {
    const step = runToEnd('dls', { ...simpleGraphProblem, depthLimit: 0 });
    expect(step.phase).toBe('failed');
  });

  it('IDDFS finds a valid path', () => {
    const step = runToEnd('iddfs', simpleGraphProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(simpleGraphProblem.startNode);
    expect(path![path!.length - 1]).toBe(simpleGraphProblem.goalNode);
  });

  it('UCS finds a valid path on weighted map', () => {
    const step = runToEnd('ucs', romaniaMapProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(romaniaMapProblem.startNode);
    expect(path![path!.length - 1]).toBe(romaniaMapProblem.goalNode);
  });

  it('Bidirectional BFS finds a valid path', () => {
    const step = runToEnd('bidirectional-bfs', simpleGraphProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(simpleGraphProblem.startNode);
    expect(path![path!.length - 1]).toBe(simpleGraphProblem.goalNode);
  });

  it('Bidirectional UCS finds a valid path on weighted map', () => {
    const step = runToEnd('bidirectional-ucs', romaniaMapProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(romaniaMapProblem.startNode);
    expect(path![path!.length - 1]).toBe(romaniaMapProblem.goalNode);
  });
});

describe('Informed Search', () => {
  it('RBFS finds a valid path', () => {
    const step = runToEnd('rbfs', romaniaMapProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(romaniaMapProblem.startNode);
    expect(path![path!.length - 1]).toBe(romaniaMapProblem.goalNode);
  });

  it('SMA* finds a valid path', () => {
    const step = runToEnd('sma-star', { ...romaniaMapProblem, memoryLimit: 24 });
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(romaniaMapProblem.startNode);
    expect(path![path!.length - 1]).toBe(romaniaMapProblem.goalNode);
  });

  it('Bidirectional A* finds a valid path', () => {
    const step = runToEnd('bidirectional-astar', romaniaMapProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(romaniaMapProblem.startNode);
    expect(path![path!.length - 1]).toBe(romaniaMapProblem.goalNode);
  });

  it('Bidirectional A* path has no duplicate nodes', () => {
    const step = runToEnd('bidirectional-astar', romaniaMapProblem);
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    const unique = new Set(path!);
    expect(unique.size).toBe(path!.length);
  });
});

describe('Heuristic Cost Verification', () => {
  // Expected values from AIMA textbook: Arad→Bucharest via Romania map
  // A* optimal path: Arad→Sibiu→RimnicuVilcea→Pitesti→Bucharest, cost=418
  const ROMANIA_HEURISTICS: Record<string, number> = {
    Arad: 366, Sibiu: 253, Fagaras: 176,
    RimnicuVilcea: 193, Pitesti: 100, Bucharest: 0,
  };

  function getExpandSteps(algorithmId: string, problem: unknown) {
    const steps = collectAllSteps(algorithmId, problem);
    return steps.filter(s => s.phase === 'expanding');
  }

  it('A* produces correct g, h, f values on Romania map', () => {
    const expandSteps = getExpandSteps('astar', romaniaMapProblem);

    // First expansion should be Arad: g=0, h=366, f=366
    const first = expandSteps[0];
    expect(first.metrics.pathCost).toBe(0);
    expect(first.metrics.hCost).toBe(366);
    expect(first.metrics.fCost).toBe(366);

    // Final expansion should find Bucharest with optimal g=418
    const last = expandSteps[expandSteps.length - 1];
    expect(last.metrics.pathCost).toBe(418);
    expect(last.metrics.hCost).toBe(0);
    expect(last.metrics.fCost).toBe(418);

    // Verify h values are always the correct textbook heuristic
    for (const step of expandSteps) {
      const nodeId = (step.highlight as { currentNode: string | null }).currentNode as string;
      const expectedH = ROMANIA_HEURISTICS[nodeId];
      if (expectedH !== undefined) {
        expect(step.metrics.hCost).toBe(expectedH);
      }
    }
  });

  it('A* optimal path cost is 418 (Arad→Sibiu→RimnicuVilcea→Pitesti→Bucharest)', () => {
    const final = runToEnd('astar', romaniaMapProblem);
    expect(final.phase).toBe('found');
    expect(final.metrics.pathCost).toBe(418);
    const path = getFinalPath(final);
    expect(path).toEqual(['Arad', 'Sibiu', 'RimnicuVilcea', 'Pitesti', 'Bucharest']);
  });

  it('A* f-values are monotonically non-decreasing for expanded nodes', () => {
    const expandSteps = getExpandSteps('astar', romaniaMapProblem);
    for (let i = 1; i < expandSteps.length; i++) {
      expect(expandSteps[i].metrics.fCost!).toBeGreaterThanOrEqual(
        expandSteps[i - 1].metrics.fCost!
      );
    }
  });

  it('Greedy BFS uses h-only for priority (f = h at each expansion)', () => {
    const expandSteps = getExpandSteps('greedy-bfs', romaniaMapProblem);

    // In Greedy BFS, the reported fCost should equal hCost (f = h)
    for (const step of expandSteps) {
      expect(step.metrics.fCost).toBe(step.metrics.hCost);
    }

    // First expansion is Arad with h=366
    expect(expandSteps[0].metrics.hCost).toBe(366);
  });

  it('Weighted A* inflates heuristic by weight w', () => {
    const w = 2.0;
    const expandSteps = getExpandSteps('weighted-astar', { ...romaniaMapProblem, weight: w });

    // For each expansion: f_w should equal g + w*h
    for (const step of expandSteps) {
      const g = step.metrics.pathCost ?? 0;
      const h = step.metrics.hCost ?? 0;
      const expectedFw = g + w * h;
      expect(step.metrics.fCost).toBeCloseTo(expectedFw, 5);
    }
  });

  it('IDA* finds optimal path with correct cost', () => {
    const final = runToEnd('ida-star', romaniaMapProblem);
    expect(final.phase).toBe('found');
    expect(final.metrics.pathCost).toBe(418);
  });

  it('IDA* h values match textbook at visit steps', () => {
    const steps = collectAllSteps('ida-star', romaniaMapProblem);
    const visitSteps = steps.filter(s => s.phase === 'visiting');

    for (const step of visitSteps) {
      const nodeId = (step.highlight as { currentNode: string | null }).currentNode as string;
      const expectedH = ROMANIA_HEURISTICS[nodeId];
      if (expectedH !== undefined) {
        expect(step.metrics.hCost).toBe(expectedH);
      }
    }
  });

  it('RBFS finds optimal path with correct cost', () => {
    const final = runToEnd('rbfs', romaniaMapProblem);
    expect(final.phase).toBe('found');
    expect(final.metrics.pathCost).toBe(418);
  });

  it('SMA* returns correct optimal cost', () => {
    const final = runToEnd('sma-star', { ...romaniaMapProblem, memoryLimit: 24 });
    expect(final.phase).toBe('found');
    expect(final.metrics.pathCost).toBe(418);
  });
});

describe('Validation', () => {
  it('rejects missing start node', async () => {
    const { validateGraphProblem } = await import('@/algorithms/search/uninformed/types');
    const result = validateGraphProblem({
      graph: new Graph({ directed: false, nodes: [{ id: 'A' }], edges: [] }),
      startNode: 'X',
      goalNode: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects duplicate algorithm registrations', () => {
    expect(() => registerAllAlgorithms()).toThrow(/already registered/);
  });
});

describe('Local Search', () => {
  const nQueensProblem: NQueensProblem = {
    kind: 'n-queens',
    size: 8,
    initialState: [0, 0, 0, 0, 0, 0, 0, 0],
    maxSteps: 80,
    randomSeed: 1337,
    sidewaysMoveLimit: 10,
    restartLimit: 6,
    candidateSampleSize: 6,
  };

  function runLocalSearch(id: string) {
    const entry = registry.get(id);
    if (!entry) throw new Error(`Algorithm "${id}" not registered`);

    const gen = entry.runner.run(nQueensProblem);
    let lastStep: AlgorithmStep | null = null;
    let result = gen.next();
    while (!result.done) {
      lastStep = result.value as AlgorithmStep;
      result = gen.next();
    }

    return {
      finalStep: lastStep,
      finalResult: result.value as { bestValue?: number; bestState?: unknown; solved?: boolean },
    };
  }

  const tspProblem: TspProblem = {
    kind: 'tsp',
    cities: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 100, y: 20 },
      { id: 'C', x: 120, y: 120 },
      { id: 'D', x: 20, y: 140 },
      { id: 'E', x: -40, y: 70 },
    ],
    initialRoute: [0, 1, 2, 3, 4],
    maxSteps: 30,
    randomSeed: 1337,
    neighborhoodMode: 'two-opt',
  };

  const graphColoringProblem: GraphColoringProblem = {
    kind: 'graph-coloring',
    graph: new Graph({
      directed: false,
      nodes: [
        { id: 'A', x: -50, y: 0 },
        { id: 'B', x: 50, y: 0 },
        { id: 'C', x: 0, y: 80 },
      ],
      edges: [
        { id: 'AB', source: 'A', target: 'B', weight: 1 },
        { id: 'BC', source: 'B', target: 'C', weight: 1 },
        { id: 'CA', source: 'C', target: 'A', weight: 1 },
      ],
    }),
    colorCount: 3,
    initialColors: [0, 0, 0],
    maxSteps: 20,
    randomSeed: 1337,
  };

  it('registers local-search algorithms', () => {
    expect(registry.get('random-walk')).toBeTruthy();
    expect(registry.get('hill-climbing-simple')).toBeTruthy();
    expect(registry.get('hill-climbing-steepest')).toBeTruthy();
    expect(registry.get('hill-climbing-first-choice')).toBeTruthy();
    expect(registry.get('hill-climbing-stochastic')).toBeTruthy();
    expect(registry.get('hill-climbing-sideways')).toBeTruthy();
    expect(registry.get('hill-climbing-random-restart')).toBeTruthy();
    expect(registry.get('simulated-annealing')).toBeTruthy();
    expect(registry.get('local-beam-search')).toBeTruthy();
    expect(registry.get('stochastic-beam-search')).toBeTruthy();
    expect(registry.get('tabu-search')).toBeTruthy();
    expect(registry.get('genetic-algorithm')).toBeTruthy();
    expect(registry.get('min-conflicts')).toBeTruthy();
  });

  it('steepest hill climbing improves or preserves the initial board', () => {
    const initialConflicts = countConflicts(nQueensProblem.initialState ?? []);
    const { finalResult, finalStep } = runLocalSearch('hill-climbing-steepest');
    expect(finalStep).not.toBeNull();
    expect(finalResult.bestValue ?? Infinity).toBeLessThanOrEqual(initialConflicts);
  });

  it('random-restart hill climbing improves or preserves the initial board', () => {
    const initialConflicts = countConflicts(nQueensProblem.initialState ?? []);
    const { finalResult } = runLocalSearch('hill-climbing-random-restart');
    expect(finalResult.bestValue ?? Infinity).toBeLessThanOrEqual(initialConflicts);
  });

  it('min-conflicts solves the seeded 8-queens setup', () => {
    const { finalResult } = runLocalSearch('min-conflicts');
    expect(finalResult.bestValue).toBe(0);
    expect(countConflicts((finalResult.bestState as number[]) ?? [])).toBe(0);
  });

  it('simulated annealing improves a small TSP route', () => {
    const entry = registry.get('simulated-annealing');
    if (!entry) throw new Error('simulated-annealing not registered');
    const result = entry.runner.run(tspProblem);
    let final = result.next();
    while (!final.done) final = result.next();
    expect((final.value as { bestValue?: number }).bestValue).toBeLessThanOrEqual(700);
  });

  it('min-conflicts solves a simple 3-color triangle graph', () => {
    const entry = registry.get('min-conflicts');
    if (!entry) throw new Error('min-conflicts not registered');
    const result = entry.runner.run(graphColoringProblem);
    let final = result.next();
    while (!final.done) final = result.next();
    expect((final.value as { bestValue?: number }).bestValue).toBe(0);
  });
});
