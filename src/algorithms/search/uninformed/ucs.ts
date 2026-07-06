import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { compareLabels } from '@/lib/natural-sort';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

interface UniformCostState {
  frontier: string[];
  explored: Set<string>;
  pathMap: Map<string, string | null>;
  foundPath: string[] | null;
  gCosts: Map<string, number>;
  hCosts: Map<string, number>;
  fCosts: Map<string, number>;
  openSet: string[];
}

export const ucsRunner: AlgorithmRunner<GraphProblem, UniformCostState, SearchHighlight> = {
  meta: {
    id: 'ucs',
    name: 'Uniform-Cost Search',
    shortName: 'UCS',
    category: 'uninformed-search',
    description: 'Expands the node with the lowest cumulative path cost g(n). Optimal for any positive edge weights.',
    timeComplexity: 'O(b^(1+⌊C*/ε⌋))',
    spaceComplexity: 'O(b^(1+⌊C*/ε⌋))',
    complete: true,
    optimal: true,
    tags: ['search', 'uninformed', 'optimal', 'priority-queue', 'cost-based'],
    bookChapter: 'AIMA 4th Ed. § 3.4.2',
    relatedAlgorithms: ['bfs', 'bidirectional-bfs'],
  },

  pseudocode: [
    'function UNIFORM-COST-SEARCH(problem):',
    '  node ← Node(problem.INITIAL, path_cost=0)',
    '  frontier ← priority queue ordered by path_cost',
    '  frontier.add(node)',
    '  reached ← {problem.INITIAL: 0}',
    '  while frontier is not empty:',
    '    node ← POP(frontier)  // lowest path_cost',
    '    if IS-GOAL(node.STATE): return node',
    '    for each child in EXPAND(problem, node):',
    '      s ← child.STATE',
    '      new_cost ← node.path_cost + step_cost',
    '      if s not in reached or new_cost < reached[s]:',
    '        reached[s] ← new_cost',
    '        frontier.push(child, new_cost)',
    '  return failure',
  ],

  validate(problem) { return validateGraphProblem(problem, { requireNonNegativeWeights: true }); },

  getInitialState(problem: GraphProblem): UniformCostState {
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, 0]]),
      fCosts: new Map([[problem.startNode, 0]]),
      openSet: [problem.startNode],
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<UniformCostState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const pq = new PriorityQueue<string>((a, b) => compareLabels(labelOf(a), labelOf(b)));
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, 0]]);
    const fCosts = new Map<string, number>([[problem.startNode, 0]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    pq.push(problem.startNode, 0);

    const snap = (): UniformCostState => ({
      frontier: pq.toArray(),
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath: null,
      gCosts: deepClone(gCosts),
      hCosts: deepClone(hCosts),
      fCosts: deepClone(fCosts),
      openSet: pq.toArray(),
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
      description: `UCS initialized. Start="${labelOf(problem.startNode)}", g=0`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'g(n)', value: 0, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: 0, color: 'text-[var(--accent)]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized Uniform-Cost Search at node ${labelOf(problem.startNode)}`, 'info')],
      statePanels: buildPanels()
    };

    while (!pq.isEmpty) {
      const current = pq.pop()!;
      if (explored.has(current)) continue;
      explored.add(current);
      nodesExpanded++;

      const g = gCosts.get(current) ?? 0;

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(current)}" with path cost g=${g}`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: pq.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: g, color: 'text-[#3FB950]' }, { label: 'g(n)', value: g, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: g, color: 'text-[var(--accent)]' }, { label: 'Memory', value: pq.size + explored.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding node ${labelOf(current)} (cost g=${g})`, 'info')],
        statePanels: buildPanels(current)
    };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal found! Optimal path cost: ${g}`,
          pseudocodeLine: 7,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: foundPath.length - 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: g, color: 'text-[#3FB950]' }, { label: 'g(n)', value: g, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: g, color: 'text-[var(--accent)]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Goal node reached with optimal cost ${g}!`, 'success')],
          statePanels: buildPanels(current, foundPath)
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        if (explored.has(neighbor)) continue;
        const newG = g + weight;
        if (newG < (gCosts.get(neighbor) ?? Infinity)) {
          gCosts.set(neighbor, newG);
          hCosts.set(neighbor, 0);
          fCosts.set(neighbor, newG);
          pathMap.set(neighbor, current);
          pq.push(neighbor, newG);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Discovered "${labelOf(neighbor)}" via "${labelOf(current)}", g=${newG}`,
            pseudocodeLine: 10,
            state: snap(),
            highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: pq.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: newG, color: 'text-[#3FB950]' }, { label: 'g(n)', value: newG, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: newG, color: 'text-[var(--accent)]' }, { label: 'Memory', value: pq.size + explored.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`Neighbor ${labelOf(neighbor)} discovered with cost g=${newG}`, 'info')],
            statePanels: buildPanels(current)
        };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'UCS failed — no path exists.',
      pseudocodeLine: 14,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: No path exists to the goal node', 'error')],
      statePanels: buildPanels()
    };
  },
};
