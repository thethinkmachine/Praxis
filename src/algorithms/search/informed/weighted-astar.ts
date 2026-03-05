import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, buildAdjacencyList, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';

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
    tags: ['search', 'informed', 'heuristic', 'priority-queue', 'suboptimal', 'bounded'],
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
    const adj = buildAdjacencyList(problem.graph);
    const labelOf = (id: string) => problem.graph.nodes.find(n => n.id === id)?.label ?? id;
    const h = createHeuristicEvaluator(problem);
    const fw = (g: number, hVal: number) => g + w * hVal;

    const pq = new PriorityQueue<string>();
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

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Weighted A* (w=${w}) initialized. Start="${labelOf(problem.startNode)}", f_w=${fw(0, h(problem.startNode)).toFixed(1)}`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, hCost: h(problem.startNode), fCost: fw(0, h(problem.startNode)), memoryUsed: 1 },
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
        metrics: { nodesExpanded, frontierSize: pq.size, currentDepth: 0, pathCost: g, hCost: hVal, fCost: fwVal, memoryUsed: pq.size + explored.size },
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
          metrics: { nodesExpanded, frontierSize: 0, currentDepth: foundPath.length - 1, pathCost: g, hCost: 0, fCost: g, memoryUsed: explored.size },
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        if (explored.has(neighbor)) continue;
        const newG = g + weight;
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
            description: `Updating "${labelOf(neighbor)}" — g=${newG}, h=${neighborH}, f_w=${neighborFw.toFixed(1)}`,
            pseudocodeLine: 14,
            state: snap(),
            highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: { nodesExpanded, frontierSize: pq.size, currentDepth: 0, pathCost: newG, hCost: neighborH, fCost: neighborFw, memoryUsed: pq.size + explored.size },
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
      metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: explored.size },
    };
  },
};
