import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { compareLabels } from '@/lib/natural-sort';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

export interface WeightedAStarProblem extends GraphProblem {
  /** Inflation factor w ≥ 1. Default 1.5. w=1 reduces to A*. */
  weight?: number;
}

export const weightedAstarRunner: AlgorithmRunner<WeightedAStarProblem, InformedSearchState, SearchHighlight> = {
  meta: {
    id: 'weighted-astar',
    name: 'Weighted A* Search',
    shortName: 'wA*',
    category: 'informed-search',
    description:
      'Inflates the heuristic by a weight w: f(n) = g(n) + w·h(n). With w > 1 the search is "focussed" toward the goal and runs faster, but the solution cost is guaranteed to be at most w times optimal (ε-suboptimal).',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(b^d)',
    complete: true,
    optimal: 'ε-suboptimal (cost ≤ w × OPT)',
    tags: ['search', 'informed', 'heuristic', 'priority-queue', 'suboptimal', 'bounded', 'inflation-weight'],
    bookChapter: 'AIMA 4th Ed. § 3.5.2',
    relatedAlgorithms: ['astar', 'greedy-bfs'],
    relationshipLabel: 'generalises A* (w=1) and Greedy BFS (w=∞)',
  },

  pseudocode: [
    'function WEIGHTED-A-STAR(problem, w):',
    '  // w=1 → A*,  w→∞ → Greedy Best-First',
    '  node ← Node(problem.INITIAL, g=0, f=w·h(INITIAL))',
    '  frontier ← priority queue ordered by f_w(n)',
    '  frontier.add(node)',
    '  reached ← {problem.INITIAL: node}',
    '  while frontier is not empty:',
    '    node ← POP(frontier)  // lowest f_w(n) = g(n) + w·h(n)',
    '    if IS-GOAL(node.STATE): return node',
    '    for each child in EXPAND(problem, node):',
    '      s ← child.STATE',
    '      new_g ← node.g + step_cost(node, s)',
    '      f_w ← new_g + w·h(s)',
    '      if s not in reached or new_g < reached[s].g:',
    '        reached[s] ← child',
    '        frontier.push(child, f_w)',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    return {
      ...base,
      warnings: [...base.warnings, ...getHeuristicValidationWarnings(problem)],
    };
  },

  getInitialState(problem: WeightedAStarProblem): InformedSearchState {
    const w = problem.weight ?? 1.5;
    const h = createHeuristicEvaluator(problem);
    const h0 = h(problem.startNode);
    const fw0 = w * h0;
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, h0]]),
      fCosts: new Map([[problem.startNode, fw0]]),
    };
  },

  *run(problem: WeightedAStarProblem): Generator<AlgorithmStep<InformedSearchState, SearchHighlight>, void> {
    const w = problem.weight ?? 1.5;
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const h = createHeuristicEvaluator(problem);
    const fw = (g: number, hVal: number) => g + w * hVal;

    const pq = new PriorityQueue<string>((a, b) => compareLabels(labelOf(a), labelOf(b)));
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const fCosts = new Map<string, number>([[problem.startNode, fw(0, h(problem.startNode))]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    pq.push(problem.startNode, fw(0, h(problem.startNode)));

    const snap = (): InformedSearchState => ({
      frontier: pq.toArray(),
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath: null,
      gCosts: deepClone(gCosts),
      hCosts: deepClone(hCosts),
      fCosts: deepClone(fCosts),
    });
    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) =>
      buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Frontier (Priority Queue)', items: pq.toArray(), variant: 'frontier' },
          { title: 'Explored', items: explored, variant: 'explored' },
        ],
      });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Weighted A* (w=${w}) initialized. Start="${labelOf(problem.startNode)}", f_w=${fw(0, h(problem.startNode)).toFixed(1)}`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'h(n)', value: h(problem.startNode), color: 'text-[var(--purple)]' }, { label: 'f(n)', value: fw(0, h(problem.startNode)), color: 'text-[var(--accent)]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized Weighted A* (w=${w}) at node ${labelOf(problem.startNode)}`, 'info')],
      statePanels: buildPanels()
    };

    while (!pq.isEmpty) {
      const current = pq.pop()!;
      if (explored.has(current)) continue;
      explored.add(current);
      nodesExpanded++;

      const g = gCosts.get(current) ?? 0;
      const hVal = h(current);
      const fwVal = fw(g, hVal);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(current)}" — g=${g}, h=${hVal}, f_w=${fwVal.toFixed(1)} (w=${w})`,
        pseudocodeLine: 7,
        state: snap(),
        highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: pq.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: g, color: 'text-[#3FB950]' }, { label: 'h(n)', value: hVal, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: fwVal, color: 'text-[var(--accent)]' }, { label: 'Memory', value: pq.size + explored.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding node ${labelOf(current)} (f_w=${fwVal.toFixed(1)})`, 'info')],
        statePanels: buildPanels(current)
    };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found! Cost: ${g} (≤ ${w}× optimal)`,
          pseudocodeLine: 8,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: foundPath.length - 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: g, color: 'text-[#3FB950]' }, { label: 'h(n)', value: 0, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: g, color: 'text-[var(--accent)]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Goal found! Suboptimal cost: ${g} (bounded by ${w}× optimal)`, 'success')],
          statePanels: buildPanels(current, foundPath)
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        if (explored.has(neighbor)) continue;
        const newG = g + weight;
        const isUpdate = gCosts.has(neighbor);
        if (newG < (gCosts.get(neighbor) ?? Infinity)) {
          gCosts.set(neighbor, newG);
          const neighborH = h(neighbor);
          const neighborFw = fw(newG, neighborH);
          hCosts.set(neighbor, neighborH);
          fCosts.set(neighbor, neighborFw);
          pathMap.set(neighbor, current);
          pq.push(neighbor, neighborFw);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `${isUpdate ? 'Updating' : 'Discovering'} "${labelOf(neighbor)}" via "${labelOf(current)}" — g=${newG}, h=${neighborH}, f_w=${neighborFw.toFixed(1)}`,
            pseudocodeLine: 14,
            state: snap(),
            highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: pq.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: newG, color: 'text-[#3FB950]' }, { label: 'h(n)', value: neighborH, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: neighborFw, color: 'text-[var(--accent)]' }, { label: 'Memory', value: pq.size + explored.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`${isUpdate ? 'Updated' : 'Discovered'} node ${labelOf(neighbor)} (f_w=${neighborFw.toFixed(1)})`, 'info')],
            statePanels: buildPanels(current)
        };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Weighted A* failed — no path exists.',
      pseudocodeLine: 16,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: All reachable nodes explored, goal not found', 'error')],
      statePanels: buildPanels()
    };
  },
};
