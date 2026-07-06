import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchHighlight } from './types';
import { validateGraphProblem, reconstructPath } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { compareLabels } from '@/lib/natural-sort';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

interface BidirectionalUcsState {
  frontierF: string[];
  frontierB: string[];
  exploredF: Set<string>;
  exploredB: Set<string>;
  pathMapF: Map<string, string | null>;
  pathMapB: Map<string, string | null>;
  gCostsF: Map<string, number>;
  gCostsB: Map<string, number>;
  meetingNode: string | null;
  bestCost: number;
  foundPath: string[] | null;
  // Compatibility subset for shared graph/tree adapters
  frontier: string[];
  explored: Set<string>;
  pathMap: Map<string, string | null>;
  gCosts: Map<string, number>;
  hCosts: Map<string, number>;
  fCosts: Map<string, number>;
}

export const bidirectionalUcsRunner: AlgorithmRunner<GraphProblem, BidirectionalUcsState, SearchHighlight> = {
  meta: {
    id: 'bidirectional-ucs',
    name: 'Bidirectional Uniform-Cost Search',
    shortName: 'Bi-UCS',
    category: 'uninformed-search',
    description:
      'Runs Uniform-Cost Search from both start and goal simultaneously. The search terminates when the best path found is no worse than any possible remaining frontier connection.',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    complete: true,
    optimal: true,
    tags: ['search', 'uninformed', 'bidirectional', 'optimal', 'priority-queue', 'cost-based'],
    bookChapter: 'AIMA 4th Ed. § 3.4.2, § 3.4.6',
    relatedAlgorithms: ['ucs', 'bidirectional-bfs', 'bidirectional-astar'],
    relationshipLabel: 'bidirectional',
  },

  pseudocode: [
    'function BIDIRECTIONAL-UCS(problem):',
    '  frontier_f ← priority queue; frontier_b ← priority queue',
    '  g_f[start] ← 0; g_b[goal] ← 0',
    '  best_cost ← ∞; meet ← null',
    '  while frontier_f and frontier_b not empty:',
    '    if min(frontier_f) + min(frontier_b) ≥ best_cost: break',
    '    expand side with smaller frontier minimum',
    '    relax outgoing edges on that side',
    '    if node seen by both sides: best_cost ← min(best_cost, g_f[n] + g_b[n])',
    '  if meet ≠ null: return stitched optimal path',
    '  return failure',
  ],

  validate(problem) {
    return validateGraphProblem(problem, { requireNonNegativeWeights: true });
  },

  getInitialState(problem: GraphProblem): BidirectionalUcsState {
    return {
      frontierF: [problem.startNode],
      frontierB: [problem.goalNode],
      exploredF: new Set(),
      exploredB: new Set(),
      pathMapF: new Map([[problem.startNode, null]]),
      pathMapB: new Map([[problem.goalNode, null]]),
      gCostsF: new Map([[problem.startNode, 0]]),
      gCostsB: new Map([[problem.goalNode, 0]]),
      meetingNode: null,
      bestCost: Infinity,
      foundPath: null,
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, 0]]),
      fCosts: new Map([[problem.startNode, 0]]),
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<BidirectionalUcsState, SearchHighlight>, void> {
    const nodeLabel = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabel.get(id) ?? id;

    const adj = problem.graph.toAdjList();

    // Reverse adjacency for backward Dijkstra/UCS on directed graphs.
    const radj = new Map<string, { neighbor: string; weight: number; edgeId: string }[]>();
    for (const n of problem.graph.nodes) radj.set(n.id, []);
    for (const e of problem.graph.edges) {
      radj.get(e.target)?.push({ neighbor: e.source, weight: e.weight, edgeId: e.id });
      if (!problem.graph.directed) {
        radj.get(e.source)?.push({ neighbor: e.target, weight: e.weight, edgeId: e.id });
      }
    }
    for (const neighbors of radj.values()) {
      neighbors.sort((a, b) => compareLabels(labelOf(a.neighbor), labelOf(b.neighbor)));
    }

    const pqF = new PriorityQueue<string>((a, b) => compareLabels(labelOf(a), labelOf(b)));
    const pqB = new PriorityQueue<string>((a, b) => compareLabels(labelOf(a), labelOf(b)));
    const exploredF = new Set<string>();
    const exploredB = new Set<string>();
    const pathMapF = new Map<string, string | null>([[problem.startNode, null]]);
    const pathMapB = new Map<string, string | null>([[problem.goalNode, null]]);
    const gCostsF = new Map<string, number>([[problem.startNode, 0]]);
    const gCostsB = new Map<string, number>([[problem.goalNode, 0]]);

    let bestCost = Infinity;
    let meetingNode: string | null = null;
    let nodesExpanded = 0;
    let stepNum = 0;

    pqF.push(problem.startNode, 0);
    pqB.push(problem.goalNode, 0);

    const frontierOf = (pq: PriorityQueue<string>, explored: Set<string>): string[] => {
      const seen = new Set<string>();
      const result: string[] = [];
      for (const node of pq.toArray()) {
        if (explored.has(node) || seen.has(node)) continue;
        seen.add(node);
        result.push(node);
      }
      return result;
    };

    const mergedCosts = (): Map<string, number> => {
      const m = new Map<string, number>();
      for (const [id, cost] of gCostsF) m.set(id, cost);
      for (const [id, cost] of gCostsB) {
        const prior = m.get(id);
        m.set(id, prior === undefined ? cost : Math.min(prior, cost));
      }
      return m;
    };

    const stitchPath = (meeting: string): string[] => {
      const forward = reconstructPath(pathMapF, meeting);
      const backward: string[] = [meeting];
      let cur = pathMapB.get(meeting) ?? null;
      while (cur !== null) {
        backward.push(cur);
        cur = pathMapB.get(cur) ?? null;
      }
      return [...forward, ...backward];
    };

    const updateBest = (node: string): boolean => {
      const gf = gCostsF.get(node);
      const gb = gCostsB.get(node);
      if (gf === undefined || gb === undefined) return false;
      const candidate = gf + gb;
      if (candidate < bestCost) {
        bestCost = candidate;
        meetingNode = node;
        return true;
      }
      return false;
    };

    const snap = (foundPath: string[] | null = null): BidirectionalUcsState => {
      const fFrontier = frontierOf(pqF, exploredF);
      const bFrontier = frontierOf(pqB, exploredB);
      const costs = mergedCosts();
      const hZero = new Map<string, number>();
      const fSame = new Map<string, number>();
      for (const [id, g] of costs) {
        hZero.set(id, 0);
        fSame.set(id, g);
      }

      return {
        frontierF: fFrontier,
        frontierB: bFrontier,
        exploredF: deepClone(exploredF),
        exploredB: deepClone(exploredB),
        pathMapF: deepClone(pathMapF),
        pathMapB: deepClone(pathMapB),
        gCostsF: deepClone(gCostsF),
        gCostsB: deepClone(gCostsB),
        meetingNode,
        bestCost,
        foundPath,
        frontier: fFrontier,
        explored: deepClone(exploredF),
        pathMap: deepClone(pathMapF),
        gCosts: costs,
        hCosts: hZero,
        fCosts: fSame,
      };
    };
    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) =>
      buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Forward Frontier', items: frontierOf(pqF, exploredF), variant: 'frontier' },
          { title: 'Backward Frontier', items: frontierOf(pqB, exploredB), variant: 'frontier' },
          { title: 'Forward Explored', items: exploredF, variant: 'explored' },
          { title: 'Backward Explored', items: exploredB, variant: 'explored' },
        ],
      });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Bi-UCS initialized. Start="${labelOf(problem.startNode)}", Goal="${labelOf(problem.goalNode)}"`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: {
        frontierNodes: new Set([problem.startNode, problem.goalNode]),
        exploredNodes: new Set(),
        currentNode: null,
        pathEdges: null,
      },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 2, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'g(n)', value: 0, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: 0, color: 'text-[var(--accent)]' }, { label: 'Memory', value: 2, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized Bidirectional UCS (Start: ${labelOf(problem.startNode)}, Goal: ${labelOf(problem.goalNode)})`, 'info')],
      statePanels: buildPanels()
    };

    if (problem.startNode === problem.goalNode) {
      const path = [problem.startNode];
      yield {
        stepNumber: stepNum++,
        phase: 'found',
        description: 'Start node is the goal node.',
        pseudocodeLine: 9,
        state: snap(path),
        highlight: {
          frontierNodes: new Set(),
          exploredNodes: new Set(),
          currentNode: problem.startNode,
          pathEdges: path,
        },
        metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'g(n)', value: 0, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: 0, color: 'text-[var(--accent)]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
        logs: [createLog('SUCCESS: Trivial solution (start equals goal)', 'success')],
        statePanels: buildPanels(problem.startNode, path)
    };
      return;
    }

    while (!pqF.isEmpty && !pqB.isEmpty) {
      const minF = pqF.peekPriority() ?? Infinity;
      const minB = pqB.peekPriority() ?? Infinity;

      if (bestCost < Infinity && minF + minB >= bestCost && meetingNode !== null) {
        const foundPath = stitchPath(meetingNode);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Termination bound met. Best path cost = ${bestCost}`,
          pseudocodeLine: 9,
          state: snap(foundPath),
          highlight: {
            frontierNodes: new Set(),
            exploredNodes: new Set([...exploredF, ...exploredB]),
            currentNode: meetingNode,
            pathEdges: foundPath,
          },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: foundPath.length - 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: bestCost, color: 'text-[#3FB950]' }, { label: 'g(n)', value: bestCost, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: bestCost, color: 'text-[var(--accent)]' }, { label: 'Memory', value: exploredF.size + exploredB.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Frontiers connected optimally via ${labelOf(meetingNode)} (cost ${bestCost})`, 'success')],
          statePanels: buildPanels(meetingNode, foundPath)
        };
        return;
      }

      const expandForward = minF <= minB;
      const pq = expandForward ? pqF : pqB;
      const explored = expandForward ? exploredF : exploredB;
      const gCosts = expandForward ? gCostsF : gCostsB;
      const gOther = expandForward ? gCostsB : gCostsF;
      const pathMap = expandForward ? pathMapF : pathMapB;
      const adjMap = expandForward ? adj : radj;
      const direction = expandForward ? 'forward' : 'backward';

      const current = pq.pop();
      if (!current) break;
      if (explored.has(current)) continue;

      explored.add(current);
      nodesExpanded++;

      const currentG = gCosts.get(current) ?? Infinity;
      const activeFrontier = new Set([
        ...frontierOf(pqF, exploredF),
        ...frontierOf(pqB, exploredB),
      ]);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding ${direction} node "${labelOf(current)}" with g=${currentG}`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: {
          frontierNodes: activeFrontier,
          exploredNodes: new Set([...exploredF, ...exploredB]),
          currentNode: current,
          pathEdges: null,
        },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: activeFrontier.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: currentG, color: 'text-[#3FB950]' }, { label: 'g(n)', value: currentG, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: currentG, color: 'text-[var(--accent)]' }, { label: 'Memory', value: activeFrontier.size + exploredF.size + exploredB.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding ${direction} frontier at ${labelOf(current)} (g=${currentG})`, 'info')],
        statePanels: buildPanels(current)
    };

      if (updateBest(current)) {
        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `New best bridge at "${labelOf(current)}" with total cost ${bestCost}`,
          pseudocodeLine: 8,
          state: snap(),
          highlight: {
            frontierNodes: activeFrontier,
            exploredNodes: new Set([...exploredF, ...exploredB]),
            currentNode: current,
            pathEdges: null,
          },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: activeFrontier.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: bestCost, color: 'text-[#3FB950]' }, { label: 'g(n)', value: currentG, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: bestCost, color: 'text-[var(--accent)]' }, { label: 'Memory', value: activeFrontier.size + exploredF.size + exploredB.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`Updated incumbent path via ${labelOf(current)} (cost ${bestCost})`, 'info')],
          statePanels: buildPanels(current)
        };
      }

      for (const { neighbor, weight } of adjMap.get(current) ?? []) {
        if (explored.has(neighbor)) continue;
        const newG = currentG + weight;
        const prior = gCosts.get(neighbor);
        if (newG < (prior ?? Infinity)) {
          const isUpdate = prior !== undefined;
          gCosts.set(neighbor, newG);
          pathMap.set(neighbor, current);
          pq.push(neighbor, newG);

          const improvedBridge = updateBest(neighbor);
          const activeAfterRelax = new Set([
            ...frontierOf(pqF, exploredF),
            ...frontierOf(pqB, exploredB),
          ]);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `${isUpdate ? 'Updating' : 'Discovering'} "${labelOf(neighbor)}" from ${direction} side with g=${newG}${improvedBridge ? `; new best total=${bestCost}` : ''}`,
            pseudocodeLine: 7,
            state: snap(),
            highlight: {
              frontierNodes: activeAfterRelax,
              exploredNodes: new Set([...exploredF, ...exploredB]),
              currentNode: current,
              pathEdges: null,
            },
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: activeAfterRelax.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: newG, color: 'text-[#3FB950]' }, { label: 'g(n)', value: newG, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: newG, color: 'text-[var(--accent)]' }, { label: 'Memory', value: activeAfterRelax.size + exploredF.size + exploredB.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`${isUpdate ? 'Updated' : 'Discovered'} ${labelOf(neighbor)} (${direction} g=${newG})`, 'info')],
            statePanels: buildPanels(current)
        };
        } else {
          updateBest(neighbor);
        }
      }
    }

    if (meetingNode !== null && bestCost < Infinity) {
      const foundPath = stitchPath(meetingNode);
      yield {
        stepNumber: stepNum++,
        phase: 'found',
        description: `Frontiers exhausted after meeting at "${labelOf(meetingNode)}". Best path cost = ${bestCost}`,
        pseudocodeLine: 9,
        state: snap(foundPath),
        highlight: {
          frontierNodes: new Set(),
          exploredNodes: new Set([...exploredF, ...exploredB]),
          currentNode: meetingNode,
          pathEdges: foundPath,
        },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: foundPath.length - 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: bestCost, color: 'text-[#3FB950]' }, { label: 'g(n)', value: bestCost, color: 'text-[var(--warning)]' }, { label: 'f(n)', value: bestCost, color: 'text-[var(--accent)]' }, { label: 'Memory', value: exploredF.size + exploredB.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`SUCCESS: Goal connected via ${labelOf(meetingNode)} (cost ${bestCost})`, 'success')],
        statePanels: buildPanels(meetingNode, foundPath)
    };
      return;
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Bidirectional UCS failed — no path exists.',
      pseudocodeLine: 10,
      state: snap(),
      highlight: {
        frontierNodes: new Set(),
        exploredNodes: new Set([...exploredF, ...exploredB]),
        currentNode: null,
        pathEdges: null,
      },
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: exploredF.size + exploredB.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: No path exists between start and goal', 'error')],
      statePanels: buildPanels()
    };
  },
};
