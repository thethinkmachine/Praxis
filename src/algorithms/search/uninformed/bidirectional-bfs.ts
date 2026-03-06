import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchHighlight } from './types';
import { validateGraphProblem, buildAdjacencyList, reconstructPath } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

interface BidirectionalSearchState {
  frontierF: string[];
  frontierB: string[];
  exploredF: Set<string>;
  exploredB: Set<string>;
  pathMapF: Map<string, string | null>;
  pathMapB: Map<string, string | null>;
  meetingNode: string | null;
  foundPath: string[] | null;
  // These fields satisfy SearchState subset for search-tree adapter
  frontier: string[];
  explored: Set<string>;
  pathMap: Map<string, string | null>;
}

export const bidirectionalBfsRunner: AlgorithmRunner<GraphProblem, BidirectionalSearchState, SearchHighlight> = {
  meta: {
    id: 'bidirectional-bfs',
    name: 'Bidirectional BFS',
    shortName: 'Bi-BFS',
    category: 'uninformed-search',
    description: 'Simultaneously searches forward from the start and backward from the goal. When the two frontiers meet, a path is found. Reduces search space from O(b^d) to O(b^(d/2)).',
    timeComplexity: 'O(b^(d/2))',
    spaceComplexity: 'O(b^(d/2))',
    complete: true,
    optimal: true,
    tags: ['search', 'uninformed', 'bidirectional', 'optimal', 'bfs'],
    bookChapter: 'AIMA 4th Ed. § 3.4.6',
    relatedAlgorithms: ['bfs', 'ucs', 'iddfs'],
  },

  pseudocode: [
    'function BIDIRECTIONAL-BFS(problem):',
    '  frontier_f ← {start}; frontier_b ← {goal}',
    '  explored_f ← {}; explored_b ← {}',
    '  pathMap_f ← {start: null}; pathMap_b ← {goal: null}',
    '  while frontier_f and frontier_b not empty:',
    '    if |frontier_f| ≤ |frontier_b|:',
    '      expand one level of frontier_f',
    '    else:',
    '      expand one level of frontier_b',
    '    if frontiers intersect: return stitched path',
    '  return failure',
  ],

  validate: validateGraphProblem,

  getInitialState(problem: GraphProblem): BidirectionalSearchState {
    return {
      frontierF: [problem.startNode],
      frontierB: [problem.goalNode],
      exploredF: new Set(),
      exploredB: new Set(),
      pathMapF: new Map([[problem.startNode, null]]),
      pathMapB: new Map([[problem.goalNode, null]]),
      meetingNode: null,
      foundPath: null,
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<BidirectionalSearchState, SearchHighlight>, void> {
    const adj = buildAdjacencyList(problem.graph);
    // Build reverse adjacency for backward search
    const radj = new Map<string, { neighbor: string; weight: number; edgeId: string }[]>();
    problem.graph.nodes.forEach(n => radj.set(n.id, []));
    problem.graph.edges.forEach(e => {
      radj.get(e.target)?.push({ neighbor: e.source, weight: e.weight, edgeId: e.id });
      if (!problem.graph.directed) {
        radj.get(e.source)?.push({ neighbor: e.target, weight: e.weight, edgeId: e.id });
      }
    });

    const labelOf = (id: string) => problem.graph.nodes.find(n => n.id === id)?.label ?? id;

    const frontierF: string[] = [problem.startNode];
    const frontierB: string[] = [problem.goalNode];
    const exploredF = new Set<string>();
    const exploredB = new Set<string>();
    const pathMapF = new Map<string, string | null>([[problem.startNode, null]]);
    const pathMapB = new Map<string, string | null>([[problem.goalNode, null]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    const snap = (meetingNode: string | null = null, foundPath: string[] | null = null): BidirectionalSearchState => ({
      frontierF: [...frontierF],
      frontierB: [...frontierB],
      exploredF: deepClone(exploredF),
      exploredB: deepClone(exploredB),
      pathMapF: deepClone(pathMapF),
      pathMapB: deepClone(pathMapB),
      meetingNode,
      foundPath,
      frontier: [...frontierF],
      explored: deepClone(exploredF),
      pathMap: deepClone(pathMapF),
    });

    // Sets for O(1) membership checks
    const frontierSetF = new Set<string>(frontierF);
    const frontierSetB = new Set<string>(frontierB);

    const checkIntersection = (): string | null => {
      for (const node of frontierSetF) {
        if (exploredB.has(node) || frontierSetB.has(node)) return node;
      }
      for (const node of exploredF) {
        if (frontierSetB.has(node)) return node;
      }
      return null;
    };

    const stitchPath = (meeting: string): string[] => {
      const pathF = reconstructPath(pathMapF, meeting);
      // Follow backward pathMap from meeting → goal (already in correct order)
      const pathB: string[] = [];
      let cur: string | null = meeting;
      while (cur !== null) {
        pathB.push(cur);
        cur = pathMapB.get(cur) ?? null;
      }
      // pathF = [start, ..., meeting], pathB = [meeting, ..., goal]
      // Combine, removing duplicate meeting node
      return [...pathF, ...pathB.slice(1)];
    };

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Bidirectional BFS: forward from "${labelOf(problem.startNode)}", backward from "${labelOf(problem.goalNode)}"`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode, problem.goalNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 2, currentDepth: 0, pathCost: 0, memoryUsed: 2 },
      logs: [createLog(`Initialized Bidirectional BFS (Start: ${labelOf(problem.startNode)}, Goal: ${labelOf(problem.goalNode)})`, 'info')],
    };

    while (frontierF.length > 0 && frontierB.length > 0) {
      // Check intersection
      const meeting = checkIntersection();
      if (meeting) {
        const foundPath = stitchPath(meeting);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Frontiers met at "${labelOf(meeting)}"! Path found, length ${foundPath.length - 1}`,
          pseudocodeLine: 9,
          state: snap(meeting, foundPath),
          highlight: { frontierNodes: new Set(), exploredNodes: new Set([...exploredF, ...exploredB]), currentNode: meeting, pathEdges: foundPath },
          metrics: { nodesExpanded, frontierSize: 0, currentDepth: Math.floor(foundPath.length / 2), pathCost: foundPath.length - 1, memoryUsed: exploredF.size + exploredB.size },
          logs: [createLog(`SUCCESS: Frontiers intersected at node ${labelOf(meeting)}!`, 'success')],
        };
        return;
      }

      // Expand the smaller frontier
      const expandForward = frontierF.length <= frontierB.length;
      const frontier = expandForward ? frontierF : frontierB;
      const frontierSet = expandForward ? frontierSetF : frontierSetB;
      const explored = expandForward ? exploredF : exploredB;
      const pathMap = expandForward ? pathMapF : pathMapB;
      const adjMap = expandForward ? adj : radj;
      const direction = expandForward ? 'forward' : 'backward';

      const levelSize = frontier.length;
      const expanded: string[] = [];

      for (let i = 0; i < levelSize; i++) {
        const current = frontier.shift()!;
        frontierSet.delete(current);
        if (explored.has(current)) continue;
        explored.add(current);
        nodesExpanded++;
        expanded.push(current);

        for (const { neighbor } of adjMap.get(current) ?? []) {
          if (!explored.has(neighbor) && !frontierSet.has(neighbor)) {
            pathMap.set(neighbor, current);
            frontier.push(neighbor);
            frontierSet.add(neighbor);
          }
        }
      }

      const displayFrontier = new Set([...frontierF, ...frontierB]);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `${direction === 'forward' ? 'Forward' : 'Backward'} expansion: ${expanded.map(labelOf).join(', ')}. Frontiers: F=${frontierF.length}, B=${frontierB.length}`,
        pseudocodeLine: expandForward ? 6 : 8,
        state: snap(),
        highlight: { frontierNodes: displayFrontier, exploredNodes: new Set([...exploredF, ...exploredB]), currentNode: expanded[expanded.length - 1] ?? null, pathEdges: null },
        metrics: { nodesExpanded, frontierSize: frontierF.length + frontierB.length, currentDepth: 0, pathCost: 0, memoryUsed: frontierF.length + frontierB.length + exploredF.size + exploredB.size },
        logs: [createLog(`Expanding ${direction} frontier (F:${frontierF.length}, B:${frontierB.length})`, 'info')],
      };
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Bidirectional BFS failed — no path found.',
      pseudocodeLine: 10,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set([...exploredF, ...exploredB]), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: exploredF.size + exploredB.size },
      logs: [createLog('FAILURE: Frontiers exhausted, no path found', 'error')],
    };
  },
};
