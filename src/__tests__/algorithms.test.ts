import { Graph } from '@/types/problem';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllAlgorithms } from '@/algorithms/register';
import { registry } from '@/algorithms/core/registry';
import { simpleGraphProblem, romaniaMapProblem } from './fixtures/mock-problems';
import { buildGameTreeProblem, edge, leaf, node } from './fixtures/game-tree-builder';
import type { AlgorithmStep, PanelSection } from '@/types/step';
import type { GraphColoringProblem, NQueensProblem, TspProblem } from '@/types/problem';
import { countConflicts } from '@/problems/local-search/n-queens';
import { routeDistance } from '@/problems/local-search/tsp';
import { createPlanningProblemFromPreset } from '@/problems/planning/presets';
import { createCspProblemFromPreset } from '@/problems/csp/presets';

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

function getMetric(step: AlgorithmStep, label: string): number | undefined {
  if (Array.isArray(step.metrics)) {
    const tile = step.metrics.find(m => m.label === label);
    return tile ? Number(tile.value) : undefined;
  }
  return undefined;
}

function getPanel(step: AlgorithmStep, title: string): PanelSection | undefined {
  return step.statePanels?.find(panel => panel.title === title);
}

function getChipPanelIds(step: AlgorithmStep, title: string): string[] | null {
  const panel = getPanel(step, title);
  if (!panel || panel.type !== 'chips') return null;
  return panel.items.map(item => item.id);
}

function panelIds(ids: string[] | null | undefined): string[] {
  return [...(ids ?? [])];
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

  it('search panels preserve current node and solution path on found steps', () => {
    const final = runToEnd('bfs', simpleGraphProblem);
    expect(getPanel(final, 'Current Node')?.type).toBe('chips');
    const solutionPath = getPanel(final, 'Solution Path');
    expect(solutionPath?.type).toBe('chips');
    expect(solutionPath?.type === 'chips' ? solutionPath.items.map(item => item.id) : null).toEqual(['S', 'B', 'G']);
  });

  it('bidirectional search panels broadcast forward and backward collections explicitly', () => {
    const expandStep = collectAllSteps('bidirectional-bfs', simpleGraphProblem)
      .find(step => step.phase === 'expanding');

    expect(expandStep).toBeTruthy();
    expect(getPanel(expandStep!, 'Forward Frontier')?.type).toBe('chips');
    expect(getPanel(expandStep!, 'Backward Frontier')?.type).toBe('chips');
    expect(getPanel(expandStep!, 'Forward Explored')?.type).toBe('chips');
    expect(getPanel(expandStep!, 'Backward Explored')?.type).toBe('chips');
  });

  it('stack-based panels render the next node to pop first', () => {
    const pushA = collectAllSteps('dfs', simpleGraphProblem)
      .find(step => step.phase === 'visiting' && step.description.includes('"A"'));

    expect(pushA).toBeTruthy();
    const frontier = getPanel(pushA!, 'Frontier (Stack)');
    expect(frontier?.type).toBe('chips');
    expect(frontier?.type === 'chips' ? frontier.items.map(item => item.id) : null).toEqual(['A', 'B']);
  });

  it('DFS does not push duplicate nodes onto the stack', () => {
    const duplicateGraphProblem = {
      graph: new Graph({
        directed: false,
        nodes: [
          { id: 'S' },
          { id: 'A' },
          { id: 'B' },
          { id: 'C' },
          { id: 'G' },
        ],
        edges: [
          { id: 'SA', source: 'S', target: 'A', weight: 1 },
          { id: 'SB', source: 'S', target: 'B', weight: 1 },
          { id: 'AC', source: 'A', target: 'C', weight: 1 },
          { id: 'BC', source: 'B', target: 'C', weight: 1 },
          { id: 'CG', source: 'C', target: 'G', weight: 1 },
        ],
      }),
      startNode: 'S',
      goalNode: 'G',
    };

    const steps = collectAllSteps('dfs', duplicateGraphProblem);
    const pushCSteps = steps.filter(
      step => step.phase === 'visiting' && step.description.includes('pushing "C" onto the stack'),
    );

    expect(pushCSteps).toHaveLength(1);
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

  it('SMGS finds a valid path', () => {
    const step = runToEnd('smgs', { ...romaniaMapProblem, memoryLimit: 24 });
    const path = getFinalPath(step);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(romaniaMapProblem.startNode);
    expect(path![path!.length - 1]).toBe(romaniaMapProblem.goalNode);
  });

  it('SMGS populates sparse-memory panels consistently', () => {
    const steps = collectAllSteps('smgs', { ...romaniaMapProblem, memoryLimit: 24 });
    let sawBoundary = false;
    let sawSparsePath = false;

    for (const step of steps) {
      const state = step.state as Record<string, unknown>;
      const openSet = Array.isArray(state.openSet) ? state.openSet as string[] : [];
      const closed = state.explored instanceof Set ? [...state.explored as Set<string>] : [];
      const kernelNodes = Array.isArray(state.kernelNodes) ? state.kernelNodes as string[] : [];
      const boundaryNodes = Array.isArray(state.boundaryNodes) ? state.boundaryNodes as string[] : [];
      const relayNodes = Array.isArray(state.relayNodes) ? state.relayNodes as string[] : [];
      const sparsePath = Array.isArray(state.sparsePath) ? state.sparsePath as string[] : null;
      const pValues = state.pValues instanceof Map ? state.pValues as Map<string, number> : new Map<string, number>();
      const currentNode = (step.highlight as { currentNode?: string | null } | undefined)?.currentNode ?? null;

      expect(getChipPanelIds(step, 'Frontier (Open Set)')).toEqual(openSet);
      expect(getChipPanelIds(step, 'Closed')).toEqual(closed);
      expect(panelIds(getChipPanelIds(step, 'Kernel'))).toEqual(panelIds(kernelNodes));
      expect(panelIds(getChipPanelIds(step, 'Boundary'))).toEqual(panelIds(boundaryNodes));
      expect(panelIds(getChipPanelIds(step, 'Relay Nodes'))).toEqual(panelIds(relayNodes));

      if (currentNode) {
        expect(getChipPanelIds(step, 'Current Node')).toEqual([currentNode]);
      } else {
        expect(getPanel(step, 'Current Node')).toBeUndefined();
      }

      expect(panelIds(boundaryNodes)).toEqual(panelIds(closed.filter(id => (pValues.get(id) ?? 0) > 0)));
      expect(panelIds(kernelNodes)).toEqual(panelIds(closed.filter(id => (pValues.get(id) ?? 0) === 0)));

      if (boundaryNodes.length > 0) {
        sawBoundary = true;
      }
      if (sparsePath) {
        expect(getChipPanelIds(step, 'Sparse Path')).toEqual(sparsePath);
        sawSparsePath = true;
      }
    }

    expect(sawBoundary).toBe(true);
    expect(sawSparsePath).toBe(true);
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

  it('search algorithms keep state panels aligned with their runtime state', () => {
    const cases: Array<[string, unknown]> = [
      ['bfs', simpleGraphProblem],
      ['dfs', simpleGraphProblem],
      ['dls', { ...simpleGraphProblem, depthLimit: 3 }],
      ['iddfs', simpleGraphProblem],
      ['ucs', romaniaMapProblem],
      ['bidirectional-bfs', simpleGraphProblem],
      ['bidirectional-ucs', romaniaMapProblem],
      ['astar', romaniaMapProblem],
      ['weighted-astar', { ...romaniaMapProblem, weight: 2 }],
      ['greedy-bfs', romaniaMapProblem],
      ['ida-star', romaniaMapProblem],
      ['rbfs', romaniaMapProblem],
      ['sma-star', { ...romaniaMapProblem, memoryLimit: 24 }],
      ['smgs', { ...romaniaMapProblem, memoryLimit: 24 }],
      ['bidirectional-astar', romaniaMapProblem],
    ];

    for (const [algorithmId, problem] of cases) {
      const steps = collectAllSteps(algorithmId, problem);

      for (const step of steps) {
        const state = step.state as Record<string, unknown>;
        const currentNode = (step.highlight as { currentNode?: string | null } | undefined)?.currentNode ?? null;
        const foundPath = Array.isArray(state.foundPath) ? state.foundPath as string[] : null;

        if (currentNode) {
          expect(getChipPanelIds(step, 'Current Node'), `${algorithmId} step ${step.stepNumber}`).toEqual([currentNode]);
        } else {
          expect(getPanel(step, 'Current Node'), `${algorithmId} step ${step.stepNumber}`).toBeUndefined();
        }

        if (foundPath && foundPath.length > 0) {
          expect(getChipPanelIds(step, 'Solution Path'), `${algorithmId} step ${step.stepNumber}`).toEqual(foundPath);
        }

        if (Array.isArray(state.frontierF) || Array.isArray(state.frontierB)) {
          expect(panelIds(getChipPanelIds(step, 'Forward Frontier')), `${algorithmId} step ${step.stepNumber}`).toEqual(panelIds(state.frontierF as string[] | undefined));
          expect(panelIds(getChipPanelIds(step, 'Backward Frontier')), `${algorithmId} step ${step.stepNumber}`).toEqual(panelIds(state.frontierB as string[] | undefined));
        } else if (Array.isArray(state.frontier) || Array.isArray(state.openSet) || Array.isArray(state.frontierStack)) {
          const frontierPanel = step.statePanels?.find(panel => panel.title.startsWith('Frontier'));
          const highlightRecord = typeof step.highlight === 'object' && step.highlight !== null
            ? step.highlight as Record<string, unknown>
            : null;
          const frontierNodesValue = highlightRecord?.frontierNodes;
          const highlightedFrontier = frontierNodesValue instanceof Set
            ? [...frontierNodesValue as Set<string>]
            : null;
          const isStackPanel = frontierPanel?.title.includes('Stack') ?? false;
          const expectedFrontier = Array.isArray(state.frontierStack)
            ? (isStackPanel
              ? [...((highlightedFrontier && highlightedFrontier.length > 0) ? highlightedFrontier : state.frontierStack as string[])].reverse()
              : ((highlightedFrontier && highlightedFrontier.length > 0) ? highlightedFrontier : state.frontierStack as string[]))
            : Array.isArray(state.openSet)
            ? state.openSet as string[]
            : Array.isArray(state.frontier)
              ? (isStackPanel ? [...state.frontier as string[]].reverse() : state.frontier as string[])
              : [];
          expect(frontierPanel?.type, `${algorithmId} step ${step.stepNumber}`).toBe('chips');
          expect(
            panelIds(frontierPanel?.type === 'chips' ? frontierPanel.items.map(item => item.id) : null),
            `${algorithmId} step ${step.stepNumber}`,
          ).toEqual(panelIds(expectedFrontier));
        }

        if (state.exploredF instanceof Set || state.exploredB instanceof Set) {
          expect(panelIds(getChipPanelIds(step, 'Forward Explored')), `${algorithmId} step ${step.stepNumber}`).toEqual(panelIds(state.exploredF instanceof Set ? [...state.exploredF as Set<string>] : []));
          expect(panelIds(getChipPanelIds(step, 'Backward Explored')), `${algorithmId} step ${step.stepNumber}`).toEqual(panelIds(state.exploredB instanceof Set ? [...state.exploredB as Set<string>] : []));
        } else if (state.explored instanceof Set) {
          const closedPanel = getPanel(step, 'Closed');
          const exploredPanel = getPanel(step, 'Explored');
          const rendered = closedPanel ?? exploredPanel;
          expect(rendered?.type, `${algorithmId} step ${step.stepNumber}`).toBe('chips');
          expect(
            panelIds(rendered?.type === 'chips' ? rendered.items.map(item => item.id) : null),
            `${algorithmId} step ${step.stepNumber}`,
          ).toEqual(panelIds([...state.explored as Set<string>]));
        }

        if (Array.isArray(state.kernelNodes)) {
          expect(panelIds(getChipPanelIds(step, 'Kernel')), `${algorithmId} step ${step.stepNumber}`).toEqual(panelIds(state.kernelNodes as string[]));
        }

        if (Array.isArray(state.boundaryNodes)) {
          expect(panelIds(getChipPanelIds(step, 'Boundary')), `${algorithmId} step ${step.stepNumber}`).toEqual(panelIds(state.boundaryNodes as string[]));
        }
      }
    }
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
    expect(getMetric(first, 'Path Cost')).toBe(0);
    expect(getMetric(first, 'h(n)')).toBe(366);
    expect(getMetric(first, 'f(n)')).toBe(366);

    // Final expansion should find Bucharest with optimal g=418
    const last = expandSteps[expandSteps.length - 1];
    expect(getMetric(last, 'Path Cost')).toBe(418);
    expect(getMetric(last, 'h(n)')).toBe(0);
    expect(getMetric(last, 'f(n)')).toBe(418);

    // Verify h values are always the correct textbook heuristic
    for (const step of expandSteps) {
      const nodeId = (step.highlight as { currentNode: string | null }).currentNode as string;
      const expectedH = ROMANIA_HEURISTICS[nodeId];
      if (expectedH !== undefined) {
        expect(getMetric(step, 'h(n)')).toBe(expectedH);
      }
    }
  });

  it('A* optimal path cost is 418 (Arad→Sibiu→RimnicuVilcea→Pitesti→Bucharest)', () => {
    const final = runToEnd('astar', romaniaMapProblem);
    expect(final.phase).toBe('found');
    expect(getMetric(final, 'Path Cost')).toBe(418);
    const path = getFinalPath(final);
    expect(path).toEqual(['Arad', 'Sibiu', 'RimnicuVilcea', 'Pitesti', 'Bucharest']);
  });

  it('A* f-values are monotonically non-decreasing for expanded nodes', () => {
    const expandSteps = getExpandSteps('astar', romaniaMapProblem);
    for (let i = 1; i < expandSteps.length; i++) {
      expect(getMetric(expandSteps[i], 'f(n)')!).toBeGreaterThanOrEqual(
        getMetric(expandSteps[i - 1], 'f(n)')!
      );
    }
  });

  it('Greedy BFS uses h-only for priority (f = h at each expansion)', () => {
    const expandSteps = getExpandSteps('greedy-bfs', romaniaMapProblem);

    // In Greedy BFS, the reported fCost should equal hCost (f = h)
    for (const step of expandSteps) {
      expect(getMetric(step, 'f(n)')).toBe(getMetric(step, 'h(n)'));
    }

    // First expansion is Arad with h=366
    expect(getMetric(expandSteps[0], 'h(n)')).toBe(366);
  });

  it('Weighted A* inflates heuristic by weight w', () => {
    const w = 2.0;
    const expandSteps = getExpandSteps('weighted-astar', { ...romaniaMapProblem, weight: w });

    // For each expansion: f_w should equal g + w*h
    for (const step of expandSteps) {
      const g = getMetric(step, 'Path Cost') ?? 0;
      const h = getMetric(step, 'h(n)') ?? 0;
      const expectedFw = g + w * h;
      expect(getMetric(step, 'f(n)')).toBeCloseTo(expectedFw, 5);
    }
  });

  it('IDA* finds optimal path with correct cost', () => {
    const final = runToEnd('ida-star', romaniaMapProblem);
    expect(final.phase).toBe('found');
    expect(getMetric(final, 'Path Cost')).toBe(418);
  });

  it('IDA* h values match textbook at visit steps', () => {
    const steps = collectAllSteps('ida-star', romaniaMapProblem);
    const visitSteps = steps.filter(s => s.phase === 'visiting');

    for (const step of visitSteps) {
      const nodeId = (step.highlight as { currentNode: string | null }).currentNode as string;
      const expectedH = ROMANIA_HEURISTICS[nodeId];
      if (expectedH !== undefined) {
        expect(getMetric(step, 'h(n)')).toBe(expectedH);
      }
    }
  });

  it('RBFS finds optimal path with correct cost', () => {
    const final = runToEnd('rbfs', romaniaMapProblem);
    expect(final.phase).toBe('found');
    expect(getMetric(final, 'Path Cost')).toBe(418);
  });

  it('SMA* returns correct optimal cost', () => {
    const final = runToEnd('sma-star', { ...romaniaMapProblem, memoryLimit: 24 });
    expect(final.phase).toBe('found');
    expect(getMetric(final, 'Path Cost')).toBe(418);
  });

  it('SMGS returns correct optimal cost under a generous memory bound', () => {
    const final = runToEnd('smgs', { ...romaniaMapProblem, memoryLimit: 24 });
    expect(final.phase).toBe('found');
    expect(getMetric(final, 'Path Cost')).toBe(418);
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
    populationSize: 16,
    constructionDepth: 4,
    pheromoneDecay: 0.25,
    pheromoneInfluence: 1.2,
    heuristicInfluence: 2,
    eliteWeight: 1.5,
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
    expect(registry.get('ant-colony-optimization')).toBeTruthy();
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

  it('ant colony optimization tracks pheromone trails on TSP', () => {
    const acoProblem: TspProblem = {
      ...tspProblem,
      populationSize: 12,
      constructionDepth: 4,
      pheromoneDecay: 0.25,
      pheromoneInfluence: 1.2,
      heuristicInfluence: 2,
      eliteWeight: 1.5,
    };

    const final = runToEnd('ant-colony-optimization', acoProblem);
    const state = final.state as {
      bestValue?: number;
      populationSize?: number;
      constructionDepth?: number;
      pheromoneDecay?: number;
      pheromoneInfluence?: number;
      heuristicInfluence?: number;
      eliteWeight?: number;
      pheromoneStats?: unknown[];
    };

    expect(state.populationSize).toBe(12);
    expect(state.constructionDepth).toBe(4);
    expect(state.pheromoneDecay).toBeCloseTo(0.25, 5);
    expect(state.pheromoneInfluence).toBeCloseTo(1.2, 5);
    expect(state.heuristicInfluence).toBeCloseTo(2, 5);
    expect(state.eliteWeight).toBeCloseTo(1.5, 5);
    expect(state.pheromoneStats?.length).toBeGreaterThan(0);
    expect(getPanel(final, 'Pheromone Trails')?.type).toBe('key-value');
    expect(getPanel(final, 'Ant Colony Preview')?.type).toBe('nodes');
    expect(state.bestValue).toBeLessThanOrEqual(routeDistance(acoProblem.cities, acoProblem.initialRoute ?? []));
  });

  it('min-conflicts solves a simple 3-color triangle graph', () => {
    const entry = registry.get('min-conflicts');
    if (!entry) throw new Error('min-conflicts not registered');
    const result = entry.runner.run(graphColoringProblem);
    let final = result.next();
    while (!final.done) final = result.next();
    expect((final.value as { bestValue?: number }).bestValue).toBe(0);
  });

  it('emits structured state panels for local-search steps', () => {
    const step = collectAllSteps('hill-climbing-steepest', nQueensProblem)
      .find(item => item.phase === 'expanding');

    expect(step).toBeTruthy();
    expect(getPanel(step!, 'Current State')?.type).toBe('key-value');
    expect(getPanel(step!, 'Best So Far')?.type).toBe('key-value');
    expect(getPanel(step!, 'Candidate Moves')?.type).toBe('nodes');
    expect(getPanel(step!, 'Run State')?.type).toBe('key-value');
  });
});

describe('Planning', () => {
  it('registers planning algorithms', () => {
    expect(registry.get('fssp')).toBeTruthy();
    expect(registry.get('bssp')).toBeTruthy();
    expect(registry.get('gsp')).toBeTruthy();
    expect(registry.get('graphplan')).toBeTruthy();
    expect(registry.get('satplan')).toBeTruthy();
    expect(registry.get('pop')).toBeTruthy();
  });

  it('FSSP solves the spare tire preset', () => {
    const problem = createPlanningProblemFromPreset('spare-tire', 'state-space');
    const final = runToEnd('fssp', problem);
    const state = final.state as { planSoFar?: string[] };

    expect(final.phase).toBe('found');
    expect(state.planSoFar?.length).toBeGreaterThan(0);
    expect(getPanel(final, 'Plan So Far')?.type).toBe('chips');
    expect(Array.isArray(final.metrics)).toBe(true);
  });

  it('BSSP solves the spare tire preset', () => {
    const problem = createPlanningProblemFromPreset('spare-tire', 'state-space');
    const final = runToEnd('bssp', problem);
    const state = final.state as { planSoFar?: string[]; currentGoals?: string[] };

    expect(final.phase).toBe('found');
    expect(state.planSoFar?.length).toBeGreaterThan(0);
    expect(state.currentGoals).toBeTruthy();
    expect(getPanel(final, 'Current Goals')?.type).toBe('chips');
  });

  it('GSP solves the spare tire preset with a visible goal stack trace', () => {
    const problem = createPlanningProblemFromPreset('spare-tire', 'goal-stack');
    const steps = collectAllSteps('gsp', problem);
    const final = steps.at(-1);
    const stackStep = steps.find((step) => getPanel(step, 'Goal Stack')?.type === 'nodes');
    const state = final?.state as { planSoFar?: string[] } | undefined;

    expect(final?.phase).toBe('found');
    expect(stackStep).toBeTruthy();
    expect(state?.planSoFar?.length).toBeGreaterThan(0);
  });

  it('GraphPlan extracts a parallel plan for the cake preset', () => {
    const problem = createPlanningProblemFromPreset('cake', 'planning-graph');
    const final = runToEnd('graphplan', problem);
    const state = final.state as { extractedPlan?: string[][] };

    expect(final.phase).toBe('found');
    expect(state.extractedPlan?.length).toBeGreaterThan(0);
    expect(getPanel(final, 'Graph Layers')?.type).toBe('nodes');
    expect(getPanel(final, 'Extracted Plan')?.type).toBe('nodes');
  });

  it('SATPlan finds a bounded plan for the cake preset', () => {
    const problem = createPlanningProblemFromPreset('cake', 'planning-graph');
    const final = runToEnd('satplan', problem);
    const state = final.state as { extractedPlan?: string[][] };

    expect(final.phase).toBe('found');
    expect(state.extractedPlan?.length).toBeGreaterThan(0);
    expect(Array.isArray(final.metrics)).toBe(true);
  });

  it('POP resolves the cake preset into a partial-order plan', () => {
    const problem = createPlanningProblemFromPreset('cake', 'partial-order');
    const final = runToEnd('pop', problem);
    const state = final.state as { partialPlan?: { openFlaws?: Array<unknown> } | null; planSoFar?: string[] };

    expect(final.phase).toBe('found');
    expect(state.partialPlan?.openFlaws ?? []).toHaveLength(0);
    expect(getPanel(final, 'Partial Plan')?.type).toBe('nodes');
  });

  it('planning runners emit metric tiles and state panels', () => {
    const problem = createPlanningProblemFromPreset('cake', 'planning-graph');
    const step = collectAllSteps('graphplan', problem).find((entry) => entry.phase === 'expanding');

    expect(step).toBeTruthy();
    expect(Array.isArray(step!.metrics)).toBe(true);
    expect((step!.metrics as Array<unknown>).length).toBeGreaterThan(0);
    expect(step!.statePanels?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('Constraint Satisfaction', () => {
  it('registers CSP algorithms', () => {
    expect(registry.get('backtracking-search')).toBeTruthy();
    expect(registry.get('forward-checking')).toBeTruthy();
    expect(registry.get('ac-3')).toBeTruthy();
    expect(registry.get('gac')).toBeTruthy();
    expect(registry.get('mac')).toBeTruthy();
    expect(registry.get('tree-csp')).toBeTruthy();
    expect(registry.get('cutset-conditioning')).toBeTruthy();
  });

  it('backtracking search solves the Australia map coloring preset', () => {
    const problem = createCspProblemFromPreset('australia-map', 'constraint-network');
    const final = runToEnd('backtracking-search', problem);
    const state = final.state as { assignment?: Record<string, string | number>; violatedConstraints?: string[] };

    expect(final.phase).toBe('found');
    expect(Object.keys(state.assignment ?? {})).toHaveLength(problem.variables.length);
    expect(state.violatedConstraints ?? []).toHaveLength(0);
  });

  it('forward checking solves the Australia map coloring preset', () => {
    const problem = createCspProblemFromPreset('australia-map', 'constraint-network');
    const final = runToEnd('forward-checking', problem);
    const state = final.state as { assignment?: Record<string, string | number> };

    expect(final.phase).toBe('found');
    expect(Object.keys(state.assignment ?? {})).toHaveLength(problem.variables.length);
    expect(getPanel(final, 'Assignment')?.type).toBe('key-value');
  });

  it('AC-3 visibly prunes domains on the easy Sudoku preset', () => {
    const problem = createCspProblemFromPreset('sudoku-4x4-easy', 'arc-consistency');
    const steps = collectAllSteps('ac-3', problem);
    const final = steps.at(-1);
    const pruneStep = steps.find((step) => getPanel(step, 'Pruned Values')?.type === 'nodes');
    const state = final?.state as { domains?: Record<string, Array<string | number>> } | undefined;
    const singletonCount = Object.values(state?.domains ?? {}).filter((values) => values.length === 1).length;

    expect(final?.phase === 'visiting' || final?.phase === 'found').toBe(true);
    expect(pruneStep).toBeTruthy();
    expect(singletonCount).toBeGreaterThan(4);
  });

  it('GAC prunes domains on the SEND + MORE = MONEY preset', () => {
    const problem = createCspProblemFromPreset('send-more-money', 'cryptarithm');
    const steps = collectAllSteps('gac', problem);
    const final = steps.at(-1);
    const pruneStep = steps.find((step) => getPanel(step, 'Pruned Values')?.type === 'nodes');

    expect(final?.phase === 'visiting' || final?.phase === 'found').toBe(true);
    expect(pruneStep).toBeTruthy();
    expect(Array.isArray(final?.metrics)).toBe(true);
  });

  it('MAC solves the easy Sudoku preset', () => {
    const problem = createCspProblemFromPreset('sudoku-4x4-easy', 'sudoku');
    const final = runToEnd('mac', problem);
    const state = final.state as { assignment?: Record<string, string | number> };

    expect(final.phase).toBe('found');
    expect(Object.keys(state.assignment ?? {})).toHaveLength(problem.variables.length);
    expect(getPanel(final, 'Domains')?.type).toBe('key-value');
  });

  it('tree-CSP solves the tree-structured map preset', () => {
    const problem = createCspProblemFromPreset('tree-map', 'structure');
    const final = runToEnd('tree-csp', problem);
    const state = final.state as { assignment?: Record<string, string | number> };

    expect(final.phase).toBe('found');
    expect(Object.keys(state.assignment ?? {})).toHaveLength(problem.variables.length);
  });

  it('cutset conditioning solves the tree-structured map preset', () => {
    const problem = createCspProblemFromPreset('tree-map', 'structure');
    const final = runToEnd('cutset-conditioning', problem);
    const state = final.state as { assignment?: Record<string, string | number> };

    expect(final.phase).toBe('found');
    expect(Object.keys(state.assignment ?? {})).toHaveLength(problem.variables.length);
    expect(getPanel(final, 'Assignment')?.type).toBe('key-value');
  });

  it('CSP runners emit metric tiles and state panels', () => {
    const problem = createCspProblemFromPreset('australia-map', 'constraint-network');
    const step = collectAllSteps('forward-checking', problem).find((entry) => entry.phase === 'expanding');

    expect(step).toBeTruthy();
    expect(Array.isArray(step!.metrics)).toBe(true);
    expect((step!.metrics as Array<unknown>).length).toBeGreaterThan(0);
    expect(step!.statePanels?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('Game Playing', () => {
  // root(MAX) -> A(MIN)->[3,5], B(MIN)->[6,2]; A=min(3,5)=3, B=min(6,2)=2,
  // root=max(3,2)=3, best move is A (id "g1"). Used for panel-shape checks.
  const shallowTree = buildGameTreeProblem(
    node('max', [
      edge(node('min', [edge(leaf(3)), edge(leaf(5))])),
      edge(node('min', [edge(leaf(6)), edge(leaf(2))])),
    ]),
  );

  // root(MAX) -> A(MIN)->[5,-10], B(MIN)->[8,6]; B dominates under both
  // adversarial (min) and averaging (expectimax) semantics, with enough
  // margin to stay positive even under MCTS's sampled convergence.
  const positiveScoreTree = buildGameTreeProblem(
    node('max', [
      edge(node('min', [edge(leaf(5)), edge(leaf(-10))])),
      edge(node('min', [edge(leaf(8)), edge(leaf(6))])),
    ]),
  );

  it('emits structured state panels for minimax', () => {
    const steps = collectAllSteps('minimax', shallowTree);
    const initial = steps[0];
    const backtracking = steps.find(step => step.phase === 'backtracking');
    const final = steps[steps.length - 1];

    expect(getPanel(initial, 'Position')?.type).toBe('key-value');
    expect(getPanel(initial, 'Available Moves')?.type).toBe('chips');
    expect(getPanel(backtracking!, 'Evaluated Moves')?.type).toBe('nodes');
    expect(getPanel(backtracking!, 'Recursion Stack')?.type).toBe('nodes');
    expect(getPanel(final, 'Principal Variation')?.type).toBe('chips');
    expect(getPanel(final, 'Search Tree')?.type).toBe('key-value');
  });

  it('emits OPEN queue details for sss-star', () => {
    const steps = collectAllSteps('sss-star', positiveScoreTree);
    const initial = steps[0];
    const final = steps[steps.length - 1];
    const state = final.state as { bestMove?: string | null; bestScore?: number } | undefined;

    expect(getPanel(initial, 'OPEN Queue')?.type).toBe('chips');
    expect(getChipPanelIds(initial, 'OPEN Queue')).toEqual(['ε']);
    expect(final.phase).toBe('found');
    expect(state?.bestMove).toBe('g4');
    expect(state?.bestScore).toBe(6);
    const searchTreePanel = getPanel(final, 'Search Tree');
    expect(searchTreePanel?.type).toBe('key-value');
    const searchTreeItems = searchTreePanel?.type === 'key-value' ? searchTreePanel.items : [];
    expect(searchTreeItems.some((item) => item.key === 'Solved')).toBe(true);
  });

  it('emits search-window details for alpha-beta', () => {
    const steps = collectAllSteps('alpha-beta', shallowTree);
    const step = steps.find(item => item.phase === 'backtracking') ?? steps[0];
    const bestMovePanel = getPanel(step, 'Best Move');

    expect(bestMovePanel?.type).toBe('key-value');
    expect(bestMovePanel?.type === 'key-value' ? bestMovePanel.items.some(item => item.key === 'Window') : false).toBe(true);
    expect(getPanel(step, 'Recursion Stack')?.type).toBe('nodes');
    expect(getPanel(step, 'Search Tree')?.type).toBe('key-value');
  });

  it('emits expected-value details for expectimax', () => {
    const steps = collectAllSteps('expectimax', positiveScoreTree);
    const final = steps.at(-1);
    const state = final?.state as { bestMove?: string | null; bestScore?: number } | undefined;

    expect(final?.phase).toBe('found');
    expect(state?.bestMove).toBe('g4');
    expect(state?.bestScore).toBeGreaterThan(0);

    const evaluatedMoves = getPanel(final!, 'Evaluated Moves');
    expect(evaluatedMoves?.type).toBe('nodes');
    expect(evaluatedMoves?.type === 'nodes' ? evaluatedMoves.items.every((item) => item.detail?.includes('score=')) : false).toBe(true);
    expect(getPanel(final!, 'Search Tree')?.type).toBe('key-value');
  });

  it('emits rollout details for mcts', () => {
    const steps = collectAllSteps('mcts', positiveScoreTree);
    const final = steps.at(-1);
    const state = final?.state as { bestMove?: string | null; bestScore?: number } | undefined;

    expect(final?.phase).toBe('found');
    expect(state?.bestMove).toBe('g4');
    expect(state?.bestScore).toBeGreaterThan(0);

    const evaluatedMoves = getPanel(final!, 'Evaluated Moves');
    expect(evaluatedMoves?.type).toBe('nodes');
    expect(evaluatedMoves?.type === 'nodes' ? evaluatedMoves.items.some((item) => item.detail?.includes('visit')) : false).toBe(true);
    expect(getPanel(final!, 'Principal Variation')?.type).toBe('chips');
  });
});
