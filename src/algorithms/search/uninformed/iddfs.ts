import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

export const iddfsRunner: AlgorithmRunner<GraphProblem, SearchState, SearchHighlight> = {
  meta: {
    id: 'iddfs',
    name: 'Iterative Deepening DFS',
    shortName: 'IDDFS',
    category: 'uninformed-search',
    description: 'Repeatedly applies DLS with increasing depth limits. Combines BFS completeness/optimality with DFS space efficiency.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(bd)',
    complete: true,
    optimal: true,
    tags: ['graph', 'uninformed', 'iterative', 'depth-limited', 'complete', 'optimal'],
    bookChapter: 'AIMA 4th Ed. § 3.4.5',
    relatedAlgorithms: ['dls', 'bfs', 'dfs'],
  },

  pseudocode: [
    'function IDDFS(problem):',
    '  for depth = 0, 1, 2, ... do',
    '    result ← DLS(problem, depth)',
    '    if result ≠ cutoff: return result',
    '',
    'function DLS(problem, l):',
    '  frontier ← LIFO stack with Node(problem.INITIAL)',
    '  result ← failure',
    '  while frontier is not empty do',
    '    node ← POP(frontier)',
    '    if IS-GOAL(node): return node',
    '    if DEPTH(node) > l: result ← cutoff',
    '    else: add children to frontier',
    '  return result',
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
    const labelOf = (id: string) =>
      problem.graph.nodes.find(n => n.id === id)?.label ?? id;
    let stepNum = 0;
    const maxDepth = problem.graph.nodes.length;

    for (let limit = 0; limit <= maxDepth; limit++) {
      const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
      const explored = new Set<string>();
      const stack: [string, string | null, number][] = [[problem.startNode, null, 0]];
      let nodesExpanded = 0;
      let cutoff = false;

      yield {
        stepNumber: stepNum++,
        phase: 'initializing',
        description: `Starting DLS iteration with depth limit = ${limit}`,
        pseudocodeLine: 1,
        state: { frontier: [problem.startNode], explored: new Set(), pathMap: new Map([[problem.startNode, null]]), foundPath: null },
        highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
        metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, memoryUsed: 1 },
        logs: [createLog(`IDDFS: Starting iteration with depth limit ${limit}`, 'info')],
      };

      while (stack.length > 0) {
        const [current, parent, depth] = stack.pop()!;
        if (explored.has(current)) continue;

        pathMap.set(current, parent);
        explored.add(current);
        nodesExpanded++;

        yield {
          stepNumber: stepNum++,
          phase: 'expanding',
          description: `[limit=${limit}] Expanding "${labelOf(current)}" at depth ${depth}`,
          pseudocodeLine: 9,
          state: { frontier: stack.map(([n]) => n), explored: deepClone(explored), pathMap: deepClone(pathMap), foundPath: null },
          highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
          metrics: { nodesExpanded, frontierSize: stack.length, currentDepth: depth, pathCost: 0, memoryUsed: stack.length + explored.size },
          logs: [createLog(`Expanding ${labelOf(current)} (depth=${depth}, it=${limit})`, 'info')],
        };

        if (current === problem.goalNode) {
          const foundPath = reconstructPath(pathMap, current);
          yield {
            stepNumber: stepNum++,
            phase: 'found',
            description: `Goal found at depth ${depth} (limit=${limit})! Path: ${foundPath.map(id => labelOf(id)).join(' → ')}`,
            pseudocodeLine: 10,
            state: { frontier: [], explored: deepClone(explored), pathMap: deepClone(pathMap), foundPath },
            highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
            metrics: { nodesExpanded, frontierSize: 0, currentDepth: depth, pathCost: foundPath.length - 1, memoryUsed: explored.size },
            logs: [createLog(`SUCCESS: Goal found at depth ${depth}!`, 'success')],
          };
          return;
        }

        if (depth >= limit) {
          cutoff = true;
          continue;
        }

        const neighbors = [...(adj.get(current) ?? [])].reverse();
        for (const { neighbor } of neighbors) {
          if (!explored.has(neighbor)) {
            stack.push([neighbor, current, depth + 1]);
            yield {
              stepNumber: stepNum++,
              phase: 'visiting',
              description: `[limit=${limit}] Discovery: pushing "${labelOf(neighbor)}" at depth ${depth + 1}`,
              pseudocodeLine: 12,
              state: { frontier: stack.map(([n]) => n), explored: deepClone(explored), pathMap: deepClone(pathMap), foundPath: null },
              highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
              metrics: { nodesExpanded, frontierSize: stack.length, currentDepth: depth + 1, pathCost: 0, memoryUsed: stack.length + explored.size },
              logs: [createLog(`Pushed neighbor ${labelOf(neighbor)} onto stack (depth=${depth + 1})`, 'info')],
            };
          }
        }
      }

      if (!cutoff) break; // No cutoff means search exhausted - failure
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'No path found (exhausted all depths).',
      pseudocodeLine: 3,
      state: { frontier: [], explored: new Set(), pathMap: new Map(), foundPath: null },
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: 0 },
      logs: [createLog('FAILURE: No path exists within search space', 'error')],
    };
  },
};
