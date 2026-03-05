import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, buildAdjacencyList, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';

export const astarRunner: AlgorithmRunner<GraphProblem, InformedSearchState, SearchHighlight> = {
  meta: {
    id: 'astar',
    name: 'A* Search',
    shortName: 'A*',
    category: 'informed-search',
    description:
      'Expands nodes in order of f(n) = g(n) + h(n), balancing path cost and heuristic estimate. With an admissible heuristic A* is both complete and optimal, and typically explores far fewer nodes than UCS.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(b^d)',
    complete: true,
    optimal: true,
    tags: ['search', 'informed', 'heuristic', 'priority-queue', 'optimal', 'complete'],
    bookChapter: 'AIMA 4th Ed. § 3.5.2',
    relatedAlgorithms: ['ucs', 'greedy-bfs', 'weighted-astar', 'ida-star'],
    relationshipLabel: 'extends UCS with heuristic',
  },

  pseudocode: [
    'function A-STAR(problem):',
    '  node ← Node(problem.INITIAL, g=0, f=h(INITIAL))',
    '  frontier ← priority queue ordered by f(n)',
    '  frontier.add(node)',
    '  reached ← {problem.INITIAL: node}',
    '  while frontier is not empty:',
    '    node ← POP(frontier)  // lowest f(n) = g(n) + h(n)',
    '    if IS-GOAL(node.STATE): return node',
    '    for each child in EXPAND(problem, node):',
    '      s ← child.STATE',
    '      new_g ← node.g + step_cost(node, s)',
    '      if s not in reached or new_g < reached[s].g:',
    '        reached[s] ← child',
    '        frontier.push(child, new_g + h(s))',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    return {
      ...base,
      warnings: [...base.warnings, ...getHeuristicValidationWarnings(problem)],
    };
  },

  getInitialState(problem: GraphProblem): InformedSearchState {
    const h = createHeuristicEvaluator(problem);
    const h0 = h(problem.startNode);
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, h0]]),
      fCosts: new Map([[problem.startNode, h0]]),
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<InformedSearchState, SearchHighlight>, void> {
    const adj = buildAdjacencyList(problem.graph);
    const labelOf = (id: string) => problem.graph.nodes.find(n => n.id === id)?.label ?? id;
    const h = createHeuristicEvaluator(problem);

    const pq = new PriorityQueue<string>();
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const fCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    pq.push(problem.startNode, h(problem.startNode));

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
      description: `A* initialized. Start="${labelOf(problem.startNode)}", g=0, h=${h(problem.startNode)}, f=${h(problem.startNode)}`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, hCost: h(problem.startNode), fCost: h(problem.startNode), memoryUsed: 1 },
    };

    while (!pq.isEmpty) {
      const current = pq.pop()!;
      if (explored.has(current)) continue;
      explored.add(current);
      nodesExpanded++;

      const g = gCosts.get(current) ?? 0;
      const hVal = h(current);
      const fVal = g + hVal;

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(current)}" — g=${g}, h=${hVal}, f=${fVal}`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: { nodesExpanded, frontierSize: pq.size, currentDepth: 0, pathCost: g, hCost: hVal, fCost: fVal, memoryUsed: pq.size + explored.size },
      };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found! Optimal cost: ${g}`,
          pseudocodeLine: 7,
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
          hCosts.set(neighbor, neighborH);
          fCosts.set(neighbor, newG + neighborH);
          pathMap.set(neighbor, current);
          pq.push(neighbor, newG + neighborH);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Updating "${labelOf(neighbor)}" via "${labelOf(current)}" — g=${newG}, h=${neighborH}, f=${newG + neighborH}`,
            pseudocodeLine: 12,
            state: snap(),
            highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: { nodesExpanded, frontierSize: pq.size, currentDepth: 0, pathCost: newG, hCost: neighborH, fCost: newG + neighborH, memoryUsed: pq.size + explored.size },
          };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'A* failed — no path exists.',
      pseudocodeLine: 14,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: explored.size },
    };
  },
};
