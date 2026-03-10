import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

export const greedyBfsRunner: AlgorithmRunner<GraphProblem, InformedSearchState, SearchHighlight> = {
  meta: {
    id: 'greedy-bfs',
    name: 'Greedy Best-First Search',
    shortName: 'Greedy BFS',
    category: 'informed-search',
    description:
      'Expands the node with the lowest heuristic estimate h(n) to the goal. Fast in practice but not guaranteed to find the optimal path — it greedily chases the goal without accounting for accumulated path cost.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(b^m)',
    complete: true,
    optimal: false,
    tags: ['search', 'informed', 'heuristic', 'priority-queue', 'greedy'],
    bookChapter: 'AIMA 4th Ed. § 3.5.1',
    relatedAlgorithms: ['astar', 'ucs'],
    relationshipLabel: 'uses h(n) only; A* adds g(n)',
  },

  pseudocode: [
    'function GREEDY-BEST-FIRST(problem):',
    '  node ← Node(problem.INITIAL)',
    '  frontier ← priority queue ordered by h(node)',
    '  frontier.add(node)',
    '  reached ← {problem.INITIAL}',
    '  while frontier is not empty:',
    '    node ← POP(frontier)  // lowest h(n)',
    '    if IS-GOAL(node.STATE): return node',
    '    for each child in EXPAND(problem, node):',
    '      s ← child.STATE',
    '      if s not in reached:',
    '        reached.add(s)',
    '        frontier.push(child, h(s))',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem);
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
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const h = createHeuristicEvaluator(problem);

    const pq = new PriorityQueue<string>((a, b) => labelOf(a).localeCompare(labelOf(b)));
    const reached = new Set<string>([problem.startNode]);
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
      description: `Greedy BFS initialized. Start="${labelOf(problem.startNode)}", h=${h(problem.startNode)}`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, hCost: h(problem.startNode), fCost: h(problem.startNode), memoryUsed: 1 },
      logs: [createLog(`Initialized Greedy BFS at node ${labelOf(problem.startNode)} (h=${h(problem.startNode)})`, 'info')],
    };

    while (!pq.isEmpty) {
      const current = pq.pop()!;
      if (explored.has(current)) continue;
      explored.add(current);
      nodesExpanded++;

      const g = gCosts.get(current) ?? 0;
      const hVal = h(current);
      const fVal = hVal; // greedy: f = h only

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(current)}" — h=${hVal}, g=${g}`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: { nodesExpanded, frontierSize: pq.size, currentDepth: 0, pathCost: g, hCost: hVal, fCost: fVal, memoryUsed: pq.size + explored.size },
        logs: [createLog(`Expanding node ${labelOf(current)} (greedy h=${hVal})`, 'info')],
      };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found! Path cost: ${g}`,
          pseudocodeLine: 7,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: { nodesExpanded, frontierSize: 0, currentDepth: foundPath.length - 1, pathCost: g, hCost: 0, fCost: g, memoryUsed: explored.size },
          logs: [createLog(`SUCCESS: Goal node reached! Final path cost: ${g}`, 'success')],
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        if (!reached.has(neighbor)) {
          reached.add(neighbor);
          pathMap.set(neighbor, current);
          const neighborG = (gCosts.get(current) ?? 0) + weight;
          const neighborH = h(neighbor);
          gCosts.set(neighbor, neighborG);
          hCosts.set(neighbor, neighborH);
          fCosts.set(neighbor, neighborH); // greedy: f = h
          pq.push(neighbor, neighborH);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Discovered "${labelOf(neighbor)}" via "${labelOf(current)}" — h=${neighborH}`,
            pseudocodeLine: 11,
            state: snap(),
            highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: { nodesExpanded, frontierSize: pq.size, currentDepth: 0, pathCost: neighborG, hCost: neighborH, fCost: neighborH, memoryUsed: pq.size + explored.size },
            logs: [createLog(`Neighbor ${labelOf(neighbor)} discovered (h=${neighborH})`, 'info')],
          };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Greedy BFS failed — no path exists.',
      pseudocodeLine: 13,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: explored.size },
      logs: [createLog('FAILURE: No path exists to the goal node', 'error')],
    };
  },
};
