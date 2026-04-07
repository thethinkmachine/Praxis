import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchState, SearchHighlight } from './types';
import { reconstructPath, getDepth, validateGraphProblem } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

export const dfsRunner: AlgorithmRunner<GraphProblem, SearchState, SearchHighlight> = {
  meta: {
    id: 'dfs',
    name: 'Depth-First Search',
    shortName: 'DFS',
    category: 'uninformed-search',
    description: 'Explores as deep as possible along each branch before backtracking. Uses a LIFO stack. Not optimal, may not terminate on infinite graphs.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(bm)',
    complete: false,
    optimal: false,
    tags: ['graph', 'uninformed', 'stack', 'lifo', 'recursive'],
    bookChapter: 'AIMA 4th Ed. § 3.4.3',
    relatedAlgorithms: ['bfs', 'dls', 'iddfs'],
  },

  pseudocode: [
    'function DFS(problem):',
    '  frontier ← a LIFO stack with Node(problem.INITIAL)',
    '  reached ← {}',
    '  while frontier is not empty do',
    '    node ← POP(frontier)  // Last in, first out',
    '    if problem.IS-GOAL(node.STATE): return node',
    '    if node.STATE not in reached then',
    '      add node.STATE to reached',
    '      for each child in EXPAND(problem, node) do',
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
    // Stack: store [nodeId, parentId]
    const stack: [string, string | null][] = [[problem.startNode, null]];
    const frontierSet = new Set<string>([problem.startNode]);
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    const snap = (): SearchState => ({
      frontier: stack.map(([n]) => n),
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
          { title: 'Frontier (Stack)', items: stack.map(([n]) => n), variant: 'frontier', order: 'reverse' },
          { title: 'Explored', items: explored, variant: 'explored' },
        ],
      });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Initialized. Stack: [${labelOf(problem.startNode)}]`,
      pseudocodeLine: 1,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized search at node ${labelOf(problem.startNode)}`, 'info')],
      statePanels: buildPanels()
    };

    while (stack.length > 0) {
      const [current, parent] = stack.pop()!;
      frontierSet.delete(current);

      if (explored.has(current)) continue;

      pathMap.set(current, parent);
      explored.add(current);
      nodesExpanded++;
      const depth = getDepth(pathMap, current);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding node "${labelOf(current)}" (depth ${depth})`,
        pseudocodeLine: 4,
        state: snap(),
        highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: stack.length, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: stack.length + explored.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding node ${labelOf(current)} (depth ${depth})`, 'info')],
        statePanels: buildPanels(current)
    };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found! Path length: ${foundPath.length - 1} steps`,
          pseudocodeLine: 5,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: foundPath.length - 1, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Goal node ${labelOf(problem.goalNode)} reached!`, 'success')],
          statePanels: buildPanels(current, foundPath)
        };
        return;
      }

      const neighbors = [...(adj.get(current) ?? [])].reverse();
      for (const { neighbor } of neighbors) {
        if (!explored.has(neighbor) && !frontierSet.has(neighbor)) {
          stack.push([neighbor, current]);
          frontierSet.add(neighbor);
          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Discovery: pushing "${labelOf(neighbor)}" onto the stack from "${labelOf(current)}"`,
            pseudocodeLine: 8,
            state: snap(),
            highlight: { frontierNodes: new Set(stack.map(([n]) => n)), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: stack.length, color: 'text-[var(--accent)]' }, { label: 'Depth', value: depth + 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'Memory', value: stack.length + explored.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`Pushed neighbor ${labelOf(neighbor)} onto stack`, 'info')],
            statePanels: buildPanels(current)
        };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Search failed — no path exists.',
      pseudocodeLine: 10,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: All reachable branches explored, goal not found', 'error')],
      statePanels: buildPanels()
    };
  },
};
