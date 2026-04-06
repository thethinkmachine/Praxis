import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchHighlight } from '../uninformed/types';
import { reconstructPath, validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

interface BidirectionalAStarState {
  frontierF: string[];
  frontierB: string[];
  exploredF: Set<string>;
  exploredB: Set<string>;
  pathMapF: Map<string, string | null>;
  pathMapB: Map<string, string | null>;
  gCostsF: Map<string, number>;
  gCostsB: Map<string, number>;
  hCostsF: Map<string, number>;
  hCostsB: Map<string, number>;
  fCostsF: Map<string, number>;
  fCostsB: Map<string, number>;
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

export const bidirectionalAstarRunner: AlgorithmRunner<GraphProblem, BidirectionalAStarState, SearchHighlight> = {
  meta: {
    id: 'bidirectional-astar',
    name: 'Bidirectional A* Search',
    shortName: 'Bi-A*',
    category: 'informed-search',
    description:
      'Runs A* from both start and goal. Forward and backward frontiers alternate by best f-cost and terminate once both minima can no longer beat the incumbent path.',
    timeComplexity: 'O(b^(d/2))',
    spaceComplexity: 'O(b^(d/2))',
    complete: true,
    optimal: true,
    tags: ['search', 'informed', 'heuristic', 'bidirectional', 'optimal', 'priority-queue'],
    bookChapter: 'AIMA 4th Ed. § 3.5.2, § 3.4.6',
    relatedAlgorithms: ['astar', 'bidirectional-ucs', 'weighted-astar'],
    relationshipLabel: 'bidirectional',
  },

  pseudocode: [
    'function BIDIRECTIONAL-A-STAR(problem):',
    '  open_f ← PQ by f_f(n)=g_f(n)+h_f(n)',
    '  open_b ← PQ by f_b(n)=g_b(n)+h_b(n)',
    '  best_cost ← ∞; meet ← null',
    '  while open_f and open_b not empty:',
    '    if min_f(open_f) ≥ best_cost and min_f(open_b) ≥ best_cost: break',
    '    expand side with lower current minimum f',
    '    relax edges; update best_cost when states connect',
    '  if meet ≠ null: return stitched optimal path',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    const warnings = [...base.warnings, ...getHeuristicValidationWarnings(problem)];
    if ((problem.heuristic?.id ?? 'manual-node') === 'manual-node') {
      warnings.push('Bi-A*: backward search uses h_b(n)=0 when manual node heuristics are selected.');
    }
    return { ...base, warnings };
  },

  getInitialState(problem: GraphProblem): BidirectionalAStarState {
    const hForward = createHeuristicEvaluator(problem);
    const backwardUsesZero = (problem.heuristic?.id ?? 'manual-node') === 'manual-node';
    const hBackward = backwardUsesZero
      ? (() => 0)
      : createHeuristicEvaluator({ ...problem, goalNode: problem.startNode });

    const hF0 = hForward(problem.startNode);
    const hB0 = hBackward(problem.goalNode);

    return {
      frontierF: [problem.startNode],
      frontierB: [problem.goalNode],
      exploredF: new Set(),
      exploredB: new Set(),
      pathMapF: new Map([[problem.startNode, null]]),
      pathMapB: new Map([[problem.goalNode, null]]),
      gCostsF: new Map([[problem.startNode, 0]]),
      gCostsB: new Map([[problem.goalNode, 0]]),
      hCostsF: new Map([[problem.startNode, hF0]]),
      hCostsB: new Map([[problem.goalNode, hB0]]),
      fCostsF: new Map([[problem.startNode, hF0]]),
      fCostsB: new Map([[problem.goalNode, hB0]]),
      meetingNode: null,
      bestCost: Infinity,
      foundPath: null,
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, hF0]]),
      fCosts: new Map([[problem.startNode, hF0]]),
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<BidirectionalAStarState, SearchHighlight>, void> {
    const nodeLabel = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabel.get(id) ?? id;

    const adj = problem.graph.toAdjList();

    // Reverse adjacency for backward expansion on directed graphs.
    const radj = new Map<string, { neighbor: string; weight: number; edgeId: string }[]>();
    for (const n of problem.graph.nodes) radj.set(n.id, []);
    for (const e of problem.graph.edges) {
      radj.get(e.target)?.push({ neighbor: e.source, weight: e.weight, edgeId: e.id });
      if (!problem.graph.directed) {
        radj.get(e.source)?.push({ neighbor: e.target, weight: e.weight, edgeId: e.id });
      }
    }
    for (const neighbors of radj.values()) {
      neighbors.sort((a, b) => labelOf(a.neighbor).localeCompare(labelOf(b.neighbor)));
    }

    const hForward = createHeuristicEvaluator(problem);
    const backwardUsesZero = (problem.heuristic?.id ?? 'manual-node') === 'manual-node';
    const hBackward = backwardUsesZero
      ? (() => 0)
      : createHeuristicEvaluator({ ...problem, goalNode: problem.startNode });

    const pqF = new PriorityQueue<string>((a, b) => labelOf(a).localeCompare(labelOf(b)));
    const pqB = new PriorityQueue<string>((a, b) => labelOf(a).localeCompare(labelOf(b)));
    const exploredF = new Set<string>();
    const exploredB = new Set<string>();
    const pathMapF = new Map<string, string | null>([[problem.startNode, null]]);
    const pathMapB = new Map<string, string | null>([[problem.goalNode, null]]);
    const gCostsF = new Map<string, number>([[problem.startNode, 0]]);
    const gCostsB = new Map<string, number>([[problem.goalNode, 0]]);
    const hCostsF = new Map<string, number>([[problem.startNode, hForward(problem.startNode)]]);
    const hCostsB = new Map<string, number>([[problem.goalNode, hBackward(problem.goalNode)]]);
    const fCostsF = new Map<string, number>([[problem.startNode, hForward(problem.startNode)]]);
    const fCostsB = new Map<string, number>([[problem.goalNode, hBackward(problem.goalNode)]]);

    let bestCost = Infinity;
    let meetingNode: string | null = null;
    let nodesExpanded = 0;
    let stepNum = 0;

    pqF.push(problem.startNode, hForward(problem.startNode));
    pqB.push(problem.goalNode, hBackward(problem.goalNode));

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

    const mergedCosts = (): { g: Map<string, number>; h: Map<string, number>; f: Map<string, number> } => {
      const g = new Map<string, number>();
      const h = new Map<string, number>();
      const f = new Map<string, number>();

      for (const [id, val] of gCostsF) g.set(id, val);
      for (const [id, val] of hCostsF) h.set(id, val);
      for (const [id, val] of fCostsF) f.set(id, val);

      for (const [id, val] of gCostsB) {
        const prior = g.get(id);
        g.set(id, prior === undefined ? val : Math.min(prior, val));
      }
      for (const [id, val] of hCostsB) {
        const prior = h.get(id);
        h.set(id, prior === undefined ? val : Math.min(prior, val));
      }
      for (const [id, val] of fCostsB) {
        const prior = f.get(id);
        f.set(id, prior === undefined ? val : Math.min(prior, val));
      }

      return { g, h, f };
    };

    const stitchPath = (meeting: string): string[] => {
      const forward = reconstructPath(pathMapF, meeting);
      // forward already ends with 'meeting', so backward starts from its parent
      const backward: string[] = [];
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

    const snap = (foundPath: string[] | null = null): BidirectionalAStarState => {
      const fFrontier = frontierOf(pqF, exploredF);
      const bFrontier = frontierOf(pqB, exploredB);
      const merged = mergedCosts();

      return {
        frontierF: fFrontier,
        frontierB: bFrontier,
        exploredF: deepClone(exploredF),
        exploredB: deepClone(exploredB),
        pathMapF: deepClone(pathMapF),
        pathMapB: deepClone(pathMapB),
        gCostsF: deepClone(gCostsF),
        gCostsB: deepClone(gCostsB),
        hCostsF: deepClone(hCostsF),
        hCostsB: deepClone(hCostsB),
        fCostsF: deepClone(fCostsF),
        fCostsB: deepClone(fCostsB),
        meetingNode,
        bestCost,
        foundPath,
        frontier: fFrontier,
        explored: deepClone(exploredF),
        pathMap: deepClone(pathMapF),
        gCosts: merged.g,
        hCosts: merged.h,
        fCosts: merged.f,
      };
    };

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `Bi-A* initialized. Start="${labelOf(problem.startNode)}", Goal="${labelOf(problem.goalNode)}"`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: {
        frontierNodes: new Set([problem.startNode, problem.goalNode]),
        exploredNodes: new Set(),
        currentNode: null,
        pathEdges: null,
      },
      metrics: {
        nodesExpanded: 0,
        frontierSize: 2,
        currentDepth: 0,
        pathCost: 0,
        hCost: hForward(problem.startNode),
        fCost: hForward(problem.startNode),
        memoryUsed: 2,
      },
      logs: [
        createLog(
          `Initialized Bidirectional A*${backwardUsesZero ? ' (backward h=0 fallback for manual heuristic)' : ''}`,
          'info',
        ),
      ],
    };

    if (problem.startNode === problem.goalNode) {
      const path = [problem.startNode];
      yield {
        stepNumber: stepNum++,
        phase: 'found',
        description: 'Start node is the goal node.',
        pseudocodeLine: 8,
        state: snap(path),
        highlight: {
          frontierNodes: new Set(),
          exploredNodes: new Set(),
          currentNode: problem.startNode,
          pathEdges: path,
        },
        metrics: {
          nodesExpanded: 0,
          frontierSize: 0,
          currentDepth: 0,
          pathCost: 0,
          gCost: 0,
          hCost: 0,
          fCost: 0,
          memoryUsed: 1,
        },
        logs: [createLog('SUCCESS: Trivial solution (start equals goal)', 'success')],
      };
      return;
    }

    while (!pqF.isEmpty && !pqB.isEmpty) {
      const minF = pqF.peekPriority() ?? Infinity;
      const minB = pqB.peekPriority() ?? Infinity;

      if (bestCost < Infinity && minF >= bestCost && minB >= bestCost && meetingNode !== null) {
        const foundPath = stitchPath(meetingNode);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Termination bound met. Best path cost = ${bestCost}`,
          pseudocodeLine: 8,
          state: snap(foundPath),
          highlight: {
            frontierNodes: new Set(),
            exploredNodes: new Set([...exploredF, ...exploredB]),
            currentNode: meetingNode,
            pathEdges: foundPath,
          },
          metrics: {
            nodesExpanded,
            frontierSize: 0,
            currentDepth: foundPath.length - 1,
            pathCost: bestCost,
            gCost: bestCost,
            fCost: bestCost,
            memoryUsed: exploredF.size + exploredB.size,
          },
          logs: [createLog(`SUCCESS: Frontiers connected optimally via ${labelOf(meetingNode)} (cost ${bestCost})`, 'success')],
        };
        return;
      }

      const expandForward = minF <= minB;
      const pq = expandForward ? pqF : pqB;
      const explored = expandForward ? exploredF : exploredB;
      const gCosts = expandForward ? gCostsF : gCostsB;
      const hCosts = expandForward ? hCostsF : hCostsB;
      const fCosts = expandForward ? fCostsF : fCostsB;
      const gOther = expandForward ? gCostsB : gCostsF;
      const hEval = expandForward ? hForward : hBackward;
      const pathMap = expandForward ? pathMapF : pathMapB;
      const adjMap = expandForward ? adj : radj;
      const direction = expandForward ? 'forward' : 'backward';

      const current = pq.pop();
      if (!current) break;
      if (explored.has(current)) continue;

      explored.add(current);
      nodesExpanded++;

      const currentG = gCosts.get(current) ?? Infinity;
      const currentH = hCosts.get(current) ?? hEval(current);
      const currentF = currentG + currentH;

      const activeFrontier = new Set([
        ...frontierOf(pqF, exploredF),
        ...frontierOf(pqB, exploredB),
      ]);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding ${direction} node "${labelOf(current)}" — g=${currentG}, h=${currentH}, f=${currentF}`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: {
          frontierNodes: activeFrontier,
          exploredNodes: new Set([...exploredF, ...exploredB]),
          currentNode: current,
          pathEdges: null,
        },
        metrics: {
          nodesExpanded,
          frontierSize: activeFrontier.size,
          currentDepth: 0,
          pathCost: currentG,
          gCost: currentG,
          hCost: currentH,
          fCost: currentF,
          memoryUsed: activeFrontier.size + exploredF.size + exploredB.size,
        },
        logs: [createLog(`Expanding ${direction} frontier at ${labelOf(current)} (f=${currentF})`, 'info')],
      };

      if (updateBest(current)) {
        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `New best bridge at "${labelOf(current)}" with total cost ${bestCost}`,
          pseudocodeLine: 7,
          state: snap(),
          highlight: {
            frontierNodes: activeFrontier,
            exploredNodes: new Set([...exploredF, ...exploredB]),
            currentNode: current,
            pathEdges: null,
          },
          metrics: {
            nodesExpanded,
            frontierSize: activeFrontier.size,
            currentDepth: 0,
            pathCost: bestCost,
            gCost: currentG,
            hCost: currentH,
            fCost: bestCost,
            memoryUsed: activeFrontier.size + exploredF.size + exploredB.size,
          },
          logs: [createLog(`Updated incumbent path via ${labelOf(current)} (cost ${bestCost})`, 'info')],
        };
      }

      for (const { neighbor, weight } of adjMap.get(current) ?? []) {
        if (explored.has(neighbor)) continue;
        const newG = currentG + weight;
        const prior = gCosts.get(neighbor);
        if (newG < (prior ?? Infinity)) {
          const isUpdate = prior !== undefined;
          const neighborH = hEval(neighbor);
          const neighborF = newG + neighborH;

          gCosts.set(neighbor, newG);
          hCosts.set(neighbor, neighborH);
          fCosts.set(neighbor, neighborF);
          pathMap.set(neighbor, current);
          pq.push(neighbor, neighborF);

          const improvedBridge = gOther.has(neighbor) ? updateBest(neighbor) : false;
          const activeAfterRelax = new Set([
            ...frontierOf(pqF, exploredF),
            ...frontierOf(pqB, exploredB),
          ]);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `${isUpdate ? 'Updating' : 'Discovering'} "${labelOf(neighbor)}" from ${direction} side — g=${newG}, h=${neighborH}, f=${neighborF}${improvedBridge ? `; new best total=${bestCost}` : ''}`,
            pseudocodeLine: 7,
            state: snap(),
            highlight: {
              frontierNodes: activeAfterRelax,
              exploredNodes: new Set([...exploredF, ...exploredB]),
              currentNode: current,
              pathEdges: null,
            },
            metrics: {
              nodesExpanded,
              frontierSize: activeAfterRelax.size,
              currentDepth: 0,
              pathCost: newG,
              gCost: newG,
              hCost: neighborH,
              fCost: neighborF,
              memoryUsed: activeAfterRelax.size + exploredF.size + exploredB.size,
            },
            logs: [createLog(`${isUpdate ? 'Updated' : 'Discovered'} ${labelOf(neighbor)} (${direction} f=${neighborF})`, 'info')],
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
        pseudocodeLine: 8,
        state: snap(foundPath),
        highlight: {
          frontierNodes: new Set(),
          exploredNodes: new Set([...exploredF, ...exploredB]),
          currentNode: meetingNode,
          pathEdges: foundPath,
        },
        metrics: {
          nodesExpanded,
          frontierSize: 0,
          currentDepth: foundPath.length - 1,
          pathCost: bestCost,
          gCost: bestCost,
          fCost: bestCost,
          memoryUsed: exploredF.size + exploredB.size,
        },
        logs: [createLog(`SUCCESS: Goal connected via ${labelOf(meetingNode)} (cost ${bestCost})`, 'success')],
      };
      return;
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'Bidirectional A* failed — no path exists.',
      pseudocodeLine: 9,
      state: snap(),
      highlight: {
        frontierNodes: new Set(),
        exploredNodes: new Set([...exploredF, ...exploredB]),
        currentNode: null,
        pathEdges: null,
      },
      metrics: {
        nodesExpanded,
        frontierSize: 0,
        currentDepth: 0,
        pathCost: Infinity,
        memoryUsed: exploredF.size + exploredB.size,
      },
      logs: [createLog('FAILURE: No path exists between start and goal', 'error')],
    };
  },
};
