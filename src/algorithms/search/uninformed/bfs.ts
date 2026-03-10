import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchState, SearchHighlight } from './types';
import { reconstructPath, getDepth, validateGraphProblem } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

export const bfsRunner: AlgorithmRunner<GraphProblem, SearchState, SearchHighlight> = {
  meta: {
    id: 'bfs',
    name: 'Breadth-First Search',
    shortName: 'BFS',
    category: 'uninformed-search',
    description: 'Explores all nodes at the current depth before moving to the next depth level. Uses a FIFO queue. Guaranteed to find the shallowest solution. Optimal only for unit-cost (unweighted) graphs.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(b^d)',
    complete: true,
    optimal: 'unit-cost only',
    tags: ['graph', 'uninformed', 'queue', 'fifo', 'complete', 'optimal'],
    bookChapter: 'AIMA 4th Ed. § 3.4.1',
    relatedAlgorithms: ['dfs', 'iddfs', 'bidirectional-bfs'],
  },

  pseudocode: [
    'function BFS(problem):',
    '  node ← Node(problem.INITIAL)',
    '  if problem.IS-GOAL(node.STATE): return node',
    '  frontier ← a FIFO queue, with node as an element',
    '  reached ← {problem.INITIAL}',
    '  while frontier is not empty do',
    '    node ← POP(frontier)',
    '    for each child in EXPAND(problem, node) do',
    '      s ← child.STATE',
    '      if problem.IS-GOAL(s): return child',
    '      if s not in reached then',
    '        add s to reached',
    '        add child to frontier',
    '  return failure',
  ],

  validate: validateGraphProblem,

  getInitialState(problem: GraphProblem): SearchState {
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<SearchState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const frontier: string[] = [problem.startNode];
    const frontierSet = new Set<string>([problem.startNode]);
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    const snap = (): SearchState => ({
      frontier: [...frontier],
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath: null,
    });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Initialized. Frontier: [${labelOf(problem.startNode)}]`,
      pseudocodeLine: 3,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, memoryUsed: 1 },
      logs: [createLog(`Initialized search at node ${labelOf(problem.startNode)}`, 'info')],
    };

    while (frontier.length > 0) {
      const current = frontier.shift()!;
      frontierSet.delete(current);
      explored.add(current);
      nodesExpanded++;
      const depth = getDepth(pathMap, current);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding node "${labelOf(current)}" (depth ${depth})`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: { frontierNodes: new Set(frontier), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: { nodesExpanded, frontierSize: frontier.length, currentDepth: depth, pathCost: 0, memoryUsed: frontier.length + explored.size },
        logs: [createLog(`Expanding node ${labelOf(current)} (depth ${depth})`, 'info')],
      };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found! Path length: ${foundPath.length - 1} steps`,
          pseudocodeLine: 9,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: { nodesExpanded, frontierSize: 0, currentDepth: depth, pathCost: foundPath.length - 1, memoryUsed: explored.size },
          logs: [createLog(`SUCCESS: Goal node ${labelOf(problem.goalNode)} reached!`, 'success')],
        };
        return;
      }

      const neighbors = adj.get(current) ?? [];
      for (const { neighbor } of neighbors) {
        if (!explored.has(neighbor) && !frontierSet.has(neighbor)) {
          pathMap.set(neighbor, current);
          frontier.push(neighbor);
          frontierSet.add(neighbor);
          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Discovering neighbor "${labelOf(neighbor)}" from "${labelOf(current)}"`,
            pseudocodeLine: 11,
            state: snap(),
            highlight: { frontierNodes: new Set(frontier), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: { nodesExpanded, frontierSize: frontier.length, currentDepth: depth + 1, pathCost: 0, memoryUsed: frontier.length + explored.size },
            logs: [createLog(`Neighbor ${labelOf(neighbor)} discovered, added to frontier`, 'info')],
          };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Search failed — no path exists between start and goal.',
      pseudocodeLine: 13,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: explored.size },
      logs: [createLog('FAILURE: All reachable nodes explored, goal not found', 'error')],
    };
  },
};
