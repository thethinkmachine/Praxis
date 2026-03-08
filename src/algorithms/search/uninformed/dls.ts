import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchState, SearchHighlight } from './types';
import { reconstructPath, getDepth, validateGraphProblem, buildAdjacencyList } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

export interface DLSProblem extends GraphProblem {
  depthLimit: number;
}

export const dlsRunner: AlgorithmRunner<DLSProblem, SearchState, SearchHighlight> = {
  meta: {
    id: 'dls',
    name: 'Depth-Limited Search',
    shortName: 'DLS',
    category: 'uninformed-search',
    description: 'DFS with a depth cutoff. Complete if solution exists within the depth limit. Building block for IDDFS.',
    timeComplexity: 'O(b^l)',
    spaceComplexity: 'O(bl)',
    complete: false,
    optimal: false,
    tags: ['graph', 'uninformed', 'depth-limited', 'backtracking'],
    bookChapter: 'AIMA 4th Ed. § 3.4.4',
    relatedAlgorithms: ['dfs', 'iddfs'],
  },

  pseudocode: [
    'function DLS(problem, l):',
    '  frontier ← LIFO stack with Node(problem.INITIAL)',
    '  result ← failure',
    '  while frontier is not empty do',
    '    node ← POP(frontier)',
    '    if problem.IS-GOAL(node.STATE): return node',
    '    if DEPTH(node) > l then',
    '      result ← cutoff',
    '    else if not CYCLE(node) then',
    '      for each child in EXPAND(problem, node) do',
    '        add child to frontier',
    '  return result',
  ],

  validate(problem: DLSProblem) {
    const base = validateGraphProblem(problem);
    if (problem.depthLimit < 0) base.errors.push('Depth limit must be non-negative');
    return { valid: base.errors.length === 0, errors: base.errors };
  },

  getInitialState(problem: DLSProblem): SearchState {
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
    };
  },

  *run(problem: DLSProblem): Generator<AlgorithmStep<SearchState, SearchHighlight>, void> {
    const adj = buildAdjacencyList(problem.graph);
    const labelOf = (id: string) =>
      problem.graph.nodes.find(n => n.id === id)?.label ?? id;
    const { depthLimit } = problem;
    const stack: [string, string | null, number][] = [[problem.startNode, null, 0]];
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    let nodesExpanded = 0;
    let stepNum = 0;
    let cutoffOccurred = false;

    const snap = (): SearchState => ({
      frontier: stack.map(([n]) => n),
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath: null,
    });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Initialized. Depth limit: ${depthLimit}. Frontier: [${labelOf(problem.startNode)}]`,
      pseudocodeLine: 1,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, memoryUsed: 1 },
      logs: [createLog(`Initialized DLS at node ${labelOf(problem.startNode)} (limit=${depthLimit})`, 'info')],
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
        description: `Expanding "${labelOf(current)}" at depth ${depth}`,
        pseudocodeLine: 4,
        state: snap(),
        highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: { nodesExpanded, frontierSize: stack.length, currentDepth: depth, pathCost: 0, memoryUsed: stack.length + explored.size },
        logs: [createLog(`Expanding node ${labelOf(current)} (depth=${depth})`, 'info')],
      };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found at depth ${depth}!`,
          pseudocodeLine: 5,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: { nodesExpanded, frontierSize: 0, currentDepth: depth, pathCost: foundPath.length - 1, memoryUsed: explored.size },
          logs: [createLog(`SUCCESS: Goal node reached at depth ${depth}!`, 'success')],
        };
        return;
      }

      if (depth >= depthLimit) {
        cutoffOccurred = true;
        yield {
          stepNumber: stepNum++,
          phase: 'pruning',
          description: `Depth limit ${depthLimit} reached at "${labelOf(current)}" — cutoff`,
          pseudocodeLine: 6,
          state: snap(),
          highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
          metrics: { nodesExpanded, frontierSize: stack.length, currentDepth: depth, pathCost: 0, memoryUsed: stack.length + explored.size },
          logs: [createLog(`Pruning branch: depth limit ${depthLimit} reached at ${labelOf(current)}`, 'warn')],
        };
        continue;
      }

      const neighbors = [...(adj.get(current) ?? [])].reverse();
      for (const { neighbor } of neighbors) {
        if (!explored.has(neighbor)) {
          stack.push([neighbor, current, depth + 1]);
          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Discovery: pushing "${labelOf(neighbor)}" (depth ${depth + 1}) onto the stack from "${labelOf(current)}"`,
            pseudocodeLine: 10,
            state: snap(),
            highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: { nodesExpanded, frontierSize: stack.length, currentDepth: depth + 1, pathCost: 0, memoryUsed: stack.length + explored.size },
            logs: [createLog(`Pushed neighbor ${labelOf(neighbor)} onto stack (depth ${depth + 1})`, 'info')],
          };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: cutoffOccurred
        ? `Cutoff — goal not found within depth limit ${depthLimit}.`
        : 'Search failed — no path exists.',
      pseudocodeLine: 11,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: explored.size },
      logs: [createLog(cutoffOccurred ? 'CUTOFF: Search space exceeded depth limit' : 'FAILURE: Goal not found', cutoffOccurred ? 'warn' : 'error')],
    };
  },
};
