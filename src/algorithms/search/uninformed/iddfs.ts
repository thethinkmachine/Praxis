import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

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
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    let stepNum = 0;
    const maxDepth = problem.graph.nodes.length;

    for (let limit = 0; limit <= maxDepth; limit++) {
      const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
      const explored = new Set<string>();
      const stack: [string, string | null, number][] = [[problem.startNode, null, 0]];
      let nodesExpanded = 0;
      let cutoff = false;
      const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) =>
        buildGraphStatePanels({
          labelOf,
          currentNode,
          solutionPath: foundPath,
          collections: [
            { title: 'Frontier (Stack)', items: stack.map(([n]) => n), variant: 'frontier', order: 'reverse' },
            { title: 'Explored', items: explored, variant: 'explored' },
          ],
        });

      yield {
        stepNumber: stepNum++,
        phase: 'initializing',
        description: `Starting DLS iteration with depth limit = ${limit}`,
        pseudocodeLine: 1,
        state: { frontier: [problem.startNode], explored: new Set(), pathMap: new Map([[problem.startNode, null]]), foundPath: null },
        highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
        metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`IDDFS: Starting iteration with depth limit ${limit}`, 'info')],
        statePanels: buildPanels()
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
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: stack.length, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: stack.length + explored.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`Expanding ${labelOf(current)} (depth=${depth}, it=${limit})`, 'info')],
          statePanels: buildPanels(current)
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
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: foundPath.length - 1, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`SUCCESS: Goal found at depth ${depth}!`, 'success')],
            statePanels: buildPanels(current, foundPath)
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
              metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: stack.length, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth + 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: stack.length + explored.size, color: 'text-[var(--text-2)]' }],
              logs: [createLog(`Pushed neighbor ${labelOf(neighbor)} onto stack (depth=${depth + 1})`, 'info')],
              statePanels: buildPanels(current)
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
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: 0, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: No path exists within search space', 'error')],
      statePanels: buildGraphStatePanels({
        labelOf,
        collections: [
          { title: 'Frontier (Stack)', items: [], variant: 'frontier', order: 'reverse' },
          { title: 'Explored', items: [], variant: 'explored' },
        ],
      })
    };
  },
};
