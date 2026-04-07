import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

export interface SMGSProblem extends GraphProblem {
  memoryLimit?: number;
}

interface SMGSState extends InformedSearchState {
  memoryLimit: number;
  prunedNodes: number;
  openSet: string[];
  kernelNodes: string[];
  boundaryNodes: string[];
}

export const smgsRunner: AlgorithmRunner<SMGSProblem, SMGSState, SearchHighlight> = {
  meta: {
    id: 'smgs',
    name: 'Sparse Memory Graph Search',
    shortName: 'SMGS',
    category: 'informed-search',
    description:
      'A sparse-memory best-first graph search that keeps OPEN ordered by f(n)=g(n)+h(n), partitions CLOSED into kernel and boundary regions, and prunes low-value kernel leaves when memory is exceeded.',
    longDescription:
      'SMGS behaves like a graph-search A* variant under normal conditions, but once the retained closed kernel grows beyond the configured memory limit it drops weakly supported kernel leaves to keep memory sparse while preserving the active boundary.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(M + |boundary|)',
    complete: 'Complete when the memory bound can preserve the active kernel needed to reach a solution',
    optimal: 'Optimal with admissible heuristics when pruning does not discard states needed for the optimal solution',
    tags: ['search', 'informed', 'heuristic', 'graph-search', 'memory-bounded', 'best-first'],
    bookChapter: 'Sparse memory heuristic search variant',
    relatedAlgorithms: ['astar', 'rbfs', 'sma-star'],
  },

  pseudocode: [
    'function SMGS(problem, memory_limit):',
    '  OPEN <- priority queue ordered by f(n) = g(n) + h(n)',
    '  CLOSED <- empty set',
    '  insert start into OPEN with g=0',
    '  while OPEN not empty:',
    '    n <- node in OPEN with lowest f(n)',
    '    if IS-GOAL(n): return solution(n)',
    '    move n from OPEN to CLOSED',
    '    for each successor s of n:',
    '      if s is new or improved: update g, f, parent and place s in OPEN',
    '    partition CLOSED into KERNEL and BOUNDARY',
    '    if |KERNEL| > memory_limit: prune worst removable kernel leaves',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    const warnings = [...base.warnings, ...getHeuristicValidationWarnings(problem)];
    const errors = [...base.errors];
    if (problem.memoryLimit !== undefined && (!Number.isFinite(problem.memoryLimit) || problem.memoryLimit < 1)) {
      errors.push('SMGS memoryLimit must be at least 1.');
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  getInitialState(problem: SMGSProblem): SMGSState {
    const h = createHeuristicEvaluator(problem);
    const h0 = h(problem.startNode);
    const memoryLimit = Math.max(1, Math.floor(problem.memoryLimit ?? 32));
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, h0]]),
      fCosts: new Map([[problem.startNode, h0]]),
      memoryLimit,
      prunedNodes: 0,
      openSet: [problem.startNode],
      kernelNodes: [],
      boundaryNodes: [],
    };
  },

  *run(problem: SMGSProblem): Generator<AlgorithmStep<SMGSState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const h = createHeuristicEvaluator(problem);
    const memoryLimit = Math.max(1, Math.floor(problem.memoryLimit ?? 32));

    const pq = new PriorityQueue<string>((a, b) => labelOf(a).localeCompare(labelOf(b)));
    const open = new Set<string>();
    const closed = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const fCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);

    let nodesExpanded = 0;
    let prunedNodes = 0;
    let stepNum = 0;

    pq.push(problem.startNode, h(problem.startNode));
    open.add(problem.startNode);

    const openList = (): string[] => {
      const seen = new Set<string>();
      return pq.toArray().filter((id) => {
        if (!open.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    };

    const computeKernelBoundary = () => {
      const kernel: string[] = [];
      const boundary: string[] = [];
      for (const id of closed) {
        const parent = pathMap.get(id) ?? null;
        if (parent === null || closed.has(parent)) {
          kernel.push(id);
        } else {
          boundary.push(id);
        }
      }
      kernel.sort((a, b) => {
        const diff = (fCosts.get(b) ?? Infinity) - (fCosts.get(a) ?? Infinity);
        return diff !== 0 ? diff : labelOf(a).localeCompare(labelOf(b));
      });
      boundary.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
      return { kernel, boundary };
    };

    const snap = (foundPath: string[] | null = null): SMGSState => {
      const { kernel, boundary } = computeKernelBoundary();
      return {
        frontier: openList(),
        explored: deepClone(closed),
        pathMap: deepClone(pathMap),
        foundPath,
        gCosts: deepClone(gCosts),
        hCosts: deepClone(hCosts),
        fCosts: deepClone(fCosts),
        memoryLimit,
        prunedNodes,
        openSet: openList(),
        kernelNodes: kernel,
        boundaryNodes: boundary,
      };
    };

    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) => {
      const { kernel, boundary } = computeKernelBoundary();
      return buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Frontier (Open Set)', items: openList(), variant: 'frontier' },
          { title: 'Kernel', items: kernel, variant: 'explored' },
          { title: 'Boundary', items: boundary, variant: 'explored' },
        ],
      });
    };

    const collectChildren = (parentId: string): string[] => {
      const children: string[] = [];
      for (const [child, parent] of pathMap) {
        if (parent === parentId && (open.has(child) || closed.has(child))) {
          children.push(child);
        }
      }
      return children;
    };

    const pruneKernelIfNeeded = function* (): Generator<AlgorithmStep<SMGSState, SearchHighlight>, void> {
      while (true) {
        const { kernel } = computeKernelBoundary();
        if (kernel.length <= memoryLimit) return;

        const removable = kernel
          .filter((id) => id !== problem.startNode && id !== problem.goalNode)
          .filter((id) => collectChildren(id).length === 0)
          .sort((a, b) => {
            const fDiff = (fCosts.get(b) ?? Infinity) - (fCosts.get(a) ?? Infinity);
            if (fDiff !== 0) return fDiff;
            const gDiff = (gCosts.get(b) ?? Infinity) - (gCosts.get(a) ?? Infinity);
            if (gDiff !== 0) return gDiff;
            return labelOf(a).localeCompare(labelOf(b));
          });

        const victim = removable[0];
        if (!victim) return;

        closed.delete(victim);
        pathMap.delete(victim);
        gCosts.delete(victim);
        hCosts.delete(victim);
        fCosts.delete(victim);
        prunedNodes++;

        yield {
          stepNumber: stepNum++,
          phase: 'pruning',
          description: `Pruned kernel leaf "${labelOf(victim)}" to respect sparse-memory limit M=${memoryLimit}.`,
          pseudocodeLine: 11,
          state: snap(),
          highlight: {
            frontierNodes: new Set(openList()),
            exploredNodes: deepClone(closed),
            currentNode: victim,
            pathEdges: null,
          },
          metrics: [
            { label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' },
            { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' },
            { label: 'Kernel', value: computeKernelBoundary().kernel.length, color: 'text-[var(--text)]' },
            { label: 'Boundary', value: computeKernelBoundary().boundary.length, color: 'text-[var(--text-2)]' },
            { label: 'Pruned', value: prunedNodes, color: 'text-[var(--warning)]' },
            { label: 'Memory', value: closed.size, color: 'text-[var(--text-2)]' },
          ],
          logs: [createLog(`SMGS pruned ${labelOf(victim)} from the kernel`, 'warn')],
          statePanels: buildPanels(victim),
        };
      }
    };

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `SMGS initialized. Start="${labelOf(problem.startNode)}", memory limit M=${memoryLimit}.`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: {
        frontierNodes: new Set([problem.startNode]),
        exploredNodes: new Set(),
        currentNode: null,
        pathEdges: null,
      },
      metrics: [
        { label: 'Expanded', value: 0, color: 'text-[var(--accent)]' },
        { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' },
        { label: 'Kernel', value: 0, color: 'text-[var(--text)]' },
        { label: 'Boundary', value: 0, color: 'text-[var(--text-2)]' },
        { label: 'f(n)', value: h(problem.startNode), color: 'text-[var(--accent)]' },
        { label: 'Memory', value: 0, color: 'text-[var(--text-2)]' },
      ],
      logs: [createLog(`Initialized SMGS with memory limit ${memoryLimit}`, 'info')],
      statePanels: buildPanels(),
    };

    while (!pq.isEmpty) {
      let current: string | undefined;
      do {
        current = pq.pop();
      } while (current !== undefined && !open.has(current));

      if (!current) break;

      open.delete(current);
      closed.add(current);
      nodesExpanded++;

      const g = gCosts.get(current) ?? 0;
      const hVal = hCosts.get(current) ?? h(current);
      const fVal = fCosts.get(current) ?? (g + hVal);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(current)}" from OPEN with g=${g}, h=${hVal}, f=${fVal}.`,
        pseudocodeLine: 5,
        state: snap(),
        highlight: {
          frontierNodes: new Set(openList()),
          exploredNodes: deepClone(closed),
          currentNode: current,
          pathEdges: null,
        },
        metrics: [
          { label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' },
          { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' },
          { label: 'g(n)', value: g, color: 'text-[var(--warning)]' },
          { label: 'h(n)', value: hVal, color: 'text-[var(--purple)]' },
          { label: 'f(n)', value: fVal, color: 'text-[var(--accent)]' },
          { label: 'Memory', value: closed.size, color: 'text-[var(--text-2)]' },
        ],
        logs: [createLog(`Expanding ${labelOf(current)} in SMGS`, 'info')],
        statePanels: buildPanels(current),
      };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found by SMGS with path cost ${g}.`,
          pseudocodeLine: 6,
          state: snap(foundPath),
          highlight: {
            frontierNodes: new Set(),
            exploredNodes: deepClone(closed),
            currentNode: current,
            pathEdges: foundPath,
          },
          metrics: [
            { label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' },
            { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' },
            { label: 'Path Cost', value: g, color: 'text-[#3FB950]' },
            { label: 'Kernel', value: computeKernelBoundary().kernel.length, color: 'text-[var(--text)]' },
            { label: 'Boundary', value: computeKernelBoundary().boundary.length, color: 'text-[var(--text-2)]' },
            { label: 'Memory', value: closed.size, color: 'text-[var(--text-2)]' },
          ],
          logs: [createLog(`SUCCESS: SMGS reached the goal with cost ${g}`, 'success')],
          statePanels: buildPanels(current, foundPath),
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        const newG = g + weight;
        const prevG = gCosts.get(neighbor);

        if (prevG !== undefined && newG >= prevG) {
          continue;
        }

        const neighborH = h(neighbor);
        const neighborF = newG + neighborH;
        const wasClosed = closed.has(neighbor);

        gCosts.set(neighbor, newG);
        hCosts.set(neighbor, neighborH);
        fCosts.set(neighbor, neighborF);
        pathMap.set(neighbor, current);

        if (wasClosed) {
          closed.delete(neighbor);
        }
        open.add(neighbor);
        pq.push(neighbor, neighborF);

        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `${wasClosed ? 'Reopened' : 'Inserted'} "${labelOf(neighbor)}" with g=${newG}, h=${neighborH}, f=${neighborF}${wasClosed ? ' after finding a better path' : ''}.`,
          pseudocodeLine: wasClosed ? 9 : 8,
          state: snap(),
          highlight: {
            frontierNodes: new Set(openList()),
            exploredNodes: deepClone(closed),
            currentNode: current,
            pathEdges: null,
          },
          metrics: [
            { label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' },
            { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' },
            { label: 'g(n)', value: newG, color: 'text-[var(--warning)]' },
            { label: 'h(n)', value: neighborH, color: 'text-[var(--purple)]' },
            { label: 'f(n)', value: neighborF, color: 'text-[var(--accent)]' },
            { label: 'Memory', value: closed.size, color: 'text-[var(--text-2)]' },
          ],
          logs: [createLog(`${wasClosed ? 'Reopened' : 'Queued'} ${labelOf(neighbor)} in SMGS`, 'info')],
          statePanels: buildPanels(current),
        };
      }

      yield* pruneKernelIfNeeded();
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'SMGS failed: OPEN was exhausted before the goal was reached.',
      pseudocodeLine: 12,
      state: snap(),
      highlight: {
        frontierNodes: new Set(),
        exploredNodes: deepClone(closed),
        currentNode: null,
        pathEdges: null,
      },
      metrics: [
        { label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' },
        { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' },
        { label: 'Kernel', value: computeKernelBoundary().kernel.length, color: 'text-[var(--text)]' },
        { label: 'Boundary', value: computeKernelBoundary().boundary.length, color: 'text-[var(--text-2)]' },
        { label: 'Pruned', value: prunedNodes, color: 'text-[var(--warning)]' },
        { label: 'Memory', value: closed.size, color: 'text-[var(--text-2)]' },
      ],
      logs: [createLog('FAILURE: SMGS exhausted OPEN without reaching the goal', 'error')],
      statePanels: buildPanels(),
    };
  },
};
