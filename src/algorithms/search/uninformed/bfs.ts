import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchState, SearchHighlight } from './types';
import { reconstructPath, getDepth, validateGraphProblem } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

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
    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) =>
      buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Frontier (Queue)', items: frontier, variant: 'frontier' },
          { title: 'Explored', items: explored, variant: 'explored' },
        ],
      });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Initialized. Frontier: [${labelOf(problem.startNode)}]`,
      pseudocodeLine: 3,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized search at node ${labelOf(problem.startNode)}`, 'info')],
      statePanels: buildPanels()
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
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: frontier.length, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: frontier.length + explored.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding node ${labelOf(current)} (depth ${depth})`, 'info')],
        statePanels: buildPanels(current)
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
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: foundPath.length - 1, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Goal node ${labelOf(problem.goalNode)} reached!`, 'success')],
          statePanels: buildPanels(current, foundPath)
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
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: frontier.length, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth + 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: frontier.length + explored.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`Neighbor ${labelOf(neighbor)} discovered, added to frontier`, 'info')],
            statePanels: buildPanels(current)
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
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: All reachable nodes explored, goal not found', 'error')],
      statePanels: buildPanels()
    };
  },
};
