import type { AlgorithmRunner } from '@/types/algorithm';
import type { Graph, GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
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
  relayNodes: string[];
  sparsePath: string[] | null;
  pValues: Map<string, number>;
}

function buildPredecessorMap(graph: Graph): Map<string, string[]> {
  const predecessors = new Map<string, Set<string>>();
  for (const node of graph.nodes) predecessors.set(node.id, new Set<string>());

  for (const edge of graph.edges) {
    predecessors.get(edge.target)?.add(edge.source);
    if (!graph.directed) {
      predecessors.get(edge.source)?.add(edge.target);
    }
  }

  return new Map(
    [...predecessors.entries()].map(([id, preds]) => [id, [...preds]]),
  );
}

export const smgsRunner: AlgorithmRunner<SMGSProblem, SMGSState, SearchHighlight> = {
  meta: {
    id: 'smgs',
    name: 'Sparse Memory Graph Search',
    shortName: 'SMGS',
    category: 'informed-search',
    description:
      'A sparse-memory best-first graph search that keeps OPEN ordered by f(n)=g(n)+h(n), stores only a sparse CLOSED boundary plus relay nodes, and reconstructs pruned solution segments after search.',
    longDescription:
      'This runner follows the paper\'s sparse-memory design more closely than a generic memory-bounded A* variant: kernel membership is tracked from predecessor counts, relay nodes preserve sparse parent links during pruning, and the final dense path is reconstructed from the sparse path.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(|OPEN| + |boundary| + |relay|)',
    complete: 'Complete with nonnegative transformed edge costs and enough memory to preserve the sparse closed boundary',
    optimal: 'Optimal when the heuristic is consistent and edge costs are nonnegative',
    tags: ['search', 'informed', 'heuristic', 'graph-search', 'memory-bounded', 'best-first'],
    bookChapter: 'Sparse memory heuristic search variant',
    relatedAlgorithms: ['astar', 'rbfs', 'sma-star'],
  },

  pseudocode: [
    'function SMGS(problem, M):',
    '  OPEN <- priority queue ordered by f(n) = g(n) + h(n)',
    '  CLOSED <- sparse set of boundary and relay nodes',
    '  each stored node keeps p(n) = count of predecessors not yet interior',
    '  while OPEN not empty:',
    '    n <- node in OPEN with lowest f(n)',
    '    move n from OPEN to CLOSED and expand it',
    '    decrement p-values of stored successors reached from n',
    '    if memory is exhausted: update relay pointers, then prune kernel nodes',
    '  if pruning occurred: rebuild dense path from sparse relay path',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    const warnings = [...base.warnings, ...getHeuristicValidationWarnings(problem)];
    const errors = [...base.errors];
    if (problem.memoryLimit !== undefined && (!Number.isFinite(problem.memoryLimit) || problem.memoryLimit < 1)) {
      errors.push('SMGS memoryLimit must be at least 1.');
    }
    warnings.push('SMGS assumes a consistent heuristic for paper-faithful A* behavior; consistency is not automatically verified.');
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
      relayNodes: [problem.startNode],
      sparsePath: null,
      pValues: new Map([[problem.startNode, 0]]),
    };
  },

  *run(problem: SMGSProblem): Generator<AlgorithmStep<SMGSState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const predecessorMap = buildPredecessorMap(problem.graph);
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const h = createHeuristicEvaluator(problem);
    const memoryLimit = Math.max(1, Math.floor(problem.memoryLimit ?? 32));

    const pq = new PriorityQueue<string>((a, b) => labelOf(a).localeCompare(labelOf(b)));
    const open = new Set<string>();
    const closed = new Set<string>();
    const denseParentMap = new Map<string, string | null>([[problem.startNode, null]]);
    const sparseParentMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const fCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const pValues = new Map<string, number>([[problem.startNode, 0]]);
    const relayNodes = new Set<string>([problem.startNode]);

    let nodesExpanded = 0;
    let prunedNodes = 0;
    let stepNum = 0;

    pq.push(problem.startNode, h(problem.startNode));
    open.add(problem.startNode);

    const storedNodes = () => new Set<string>([...open, ...closed]);

    const openList = (): string[] => {
      const seen = new Set<string>();
      return pq.toArray().filter((id) => {
        if (!open.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    };

    const initializePValue = (nodeId: string, generatingParent: string | null): number => {
      const predecessors = predecessorMap.get(nodeId) ?? [];
      const discount = generatingParent !== null && predecessors.includes(generatingParent) ? 1 : 0;
      return Math.max(0, predecessors.length - discount);
    };

    const decrementStoredPredecessorCount = (nodeId: string) => {
      const current = pValues.get(nodeId);
      if (current === undefined || current <= 0) return;
      pValues.set(nodeId, current - 1);
    };

    const computeKernelBoundary = () => {
      const kernel: string[] = [];
      const boundary: string[] = [];
      for (const id of closed) {
        const p = pValues.get(id) ?? 0;
        if (p === 0) {
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

    const compressedSparseParentOf = (nodeId: string): string | null => {
      const retained = storedNodes();
      let parent = sparseParentMap.get(nodeId) ?? null;
      const seen = new Set<string>();

      while (parent !== null && !retained.has(parent) && !relayNodes.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        parent = sparseParentMap.get(parent) ?? null;
      }

      return parent;
    };

    const visibleSparseParents = () => {
      const map = new Map<string, string | null>();
      for (const id of storedNodes()) {
        map.set(id, id === problem.startNode ? null : compressedSparseParentOf(id));
      }
      return map;
    };

    const extractSparsePath = (goalNode: string): string[] => {
      const path: string[] = [];
      const seen = new Set<string>();
      let current: string | null = goalNode;

      while (current !== null && !seen.has(current)) {
        path.unshift(current);
        seen.add(current);
        current = current === problem.startNode ? null : compressedSparseParentOf(current);
      }

      return path;
    };

    const shortestPathBetween = (start: string, goal: string): string[] | null => {
      if (start === goal) return [start];
      const dist = new Map<string, number>([[start, 0]]);
      const parent = new Map<string, string | null>([[start, null]]);
      const settled = new Set<string>();
      const localPQ = new PriorityQueue<string>((a, b) => labelOf(a).localeCompare(labelOf(b)));
      localPQ.push(start, 0);

      while (!localPQ.isEmpty) {
        const current = localPQ.pop();
        if (!current || settled.has(current)) continue;
        settled.add(current);
        if (current === goal) break;

        const currentDist = dist.get(current) ?? Infinity;
        for (const { neighbor, weight } of adj.get(current) ?? []) {
          const nextDist = currentDist + weight;
          if (nextDist < (dist.get(neighbor) ?? Infinity)) {
            dist.set(neighbor, nextDist);
            parent.set(neighbor, current);
            localPQ.push(neighbor, nextDist);
          }
        }
      }

      if (!parent.has(goal)) return null;

      const path: string[] = [];
      let current: string | null = goal;
      while (current !== null) {
        path.unshift(current);
        current = parent.get(current) ?? null;
      }
      return path;
    };

    const reconstructDensePath = (goalNode: string): { sparsePath: string[]; densePath: string[] } => {
      const sparsePath = extractSparsePath(goalNode);
      if (sparsePath.length <= 1) {
        return { sparsePath, densePath: sparsePath };
      }

      const densePath = [sparsePath[0]];
      for (let i = 1; i < sparsePath.length; i++) {
        const from = sparsePath[i - 1];
        const to = sparsePath[i];
        if (denseParentMap.get(to) === from) {
          densePath.push(to);
          continue;
        }

        const segment = shortestPathBetween(from, to);
        if (!segment) {
          return { sparsePath, densePath: sparsePath };
        }
        densePath.push(...segment.slice(1));
      }

      return { sparsePath, densePath };
    };

    const snap = (foundPath: string[] | null = null, sparsePath: string[] | null = null): SMGSState => {
      const { kernel, boundary } = computeKernelBoundary();
      return {
        frontier: openList(),
        explored: deepClone(closed),
        pathMap: deepClone(visibleSparseParents()),
        foundPath,
        gCosts: deepClone(gCosts),
        hCosts: deepClone(hCosts),
        fCosts: deepClone(fCosts),
        memoryLimit,
        prunedNodes,
        openSet: openList(),
        kernelNodes: kernel,
        boundaryNodes: boundary,
        relayNodes: [...relayNodes].sort((a, b) => labelOf(a).localeCompare(labelOf(b))),
        sparsePath,
        pValues: deepClone(pValues),
      };
    };

    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null, sparsePath: string[] | null = null) => {
      const { kernel, boundary } = computeKernelBoundary();
      return buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Frontier (Open Set)', items: openList(), variant: 'frontier' },
          { title: 'Closed', items: closed, variant: 'explored' },
          { title: 'Kernel', items: kernel, variant: 'explored' },
          { title: 'Boundary', items: boundary, variant: 'explored' },
          { title: 'Relay Nodes', items: relayNodes, variant: 'path' },
          ...(sparsePath ? [{ title: 'Sparse Path', items: sparsePath, variant: 'path' as const }] : []),
        ],
      });
    };

    const pruneKernelIfNeeded = function* (): Generator<AlgorithmStep<SMGSState, SearchHighlight>, void> {
      while (true) {
        const { kernel, boundary } = computeKernelBoundary();
        const removable = kernel
          .filter((id) => id !== problem.startNode && id !== problem.goalNode)
          .filter((id) => !relayNodes.has(id))
          .sort((a, b) => {
            const fDiff = (fCosts.get(b) ?? Infinity) - (fCosts.get(a) ?? Infinity);
            if (fDiff !== 0) return fDiff;
            const gDiff = (gCosts.get(b) ?? Infinity) - (gCosts.get(a) ?? Infinity);
            if (gDiff !== 0) return gDiff;
            return labelOf(a).localeCompare(labelOf(b));
          });

        if (removable.length <= memoryLimit) return;

        const victim = removable[0];
        if (!victim) return;

        const promotedRelays: string[] = [];
        const victimSparseParent = compressedSparseParentOf(victim);
        for (const boundaryNode of boundary) {
          if (denseParentMap.get(boundaryNode) !== victim) continue;
          sparseParentMap.set(boundaryNode, victimSparseParent);
          relayNodes.add(boundaryNode);
          promotedRelays.push(boundaryNode);
        }

        closed.delete(victim);
        pValues.delete(victim);
        gCosts.delete(victim);
        hCosts.delete(victim);
        fCosts.delete(victim);
        prunedNodes++;

        yield {
          stepNumber: stepNum++,
          phase: 'pruning',
          description: promotedRelays.length > 0
            ? `Pruned kernel node "${labelOf(victim)}" and promoted ${promotedRelays.map(labelOf).join(', ')} to relay nodes.`
            : `Pruned kernel node "${labelOf(victim)}" to respect sparse-memory limit M=${memoryLimit}.`,
          pseudocodeLine: 8,
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
            { label: 'Relay', value: relayNodes.size, color: 'text-[#3FB950]' },
            { label: 'Memory', value: open.size + closed.size, color: 'text-[var(--text-2)]' },
          ],
          logs: [createLog(`SMGS pruned ${labelOf(victim)} from the retained kernel`, 'warn')],
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
        { label: 'Relay', value: 1, color: 'text-[#3FB950]' },
        { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' },
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
          { label: 'Memory', value: open.size + closed.size, color: 'text-[var(--text-2)]' },
        ],
        logs: [createLog(`Expanding ${labelOf(current)} in SMGS`, 'info')],
        statePanels: buildPanels(current),
      };

      if (current === problem.goalNode) {
        const { sparsePath, densePath } = reconstructDensePath(current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: prunedNodes > 0
            ? `Goal "${labelOf(problem.goalNode)}" found. Reconstructed dense path from a sparse relay path of ${sparsePath.length} nodes.`
            : `Goal "${labelOf(problem.goalNode)}" found by SMGS with path cost ${g}.`,
          pseudocodeLine: 9,
          state: snap(densePath, sparsePath),
          highlight: {
            frontierNodes: new Set(),
            exploredNodes: deepClone(closed),
            currentNode: current,
            pathEdges: densePath,
          },
          metrics: [
            { label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' },
            { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' },
            { label: 'Path Cost', value: g, color: 'text-[#3FB950]' },
            { label: 'Kernel', value: computeKernelBoundary().kernel.length, color: 'text-[var(--text)]' },
            { label: 'Boundary', value: computeKernelBoundary().boundary.length, color: 'text-[var(--text-2)]' },
            { label: 'Relay', value: relayNodes.size, color: 'text-[#3FB950]' },
            { label: 'Memory', value: open.size + closed.size, color: 'text-[var(--text-2)]' },
          ],
          logs: [createLog(`SUCCESS: SMGS reached the goal with cost ${g}`, 'success')],
          statePanels: buildPanels(current, densePath, sparsePath),
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        if (pValues.has(neighbor)) {
          decrementStoredPredecessorCount(neighbor);
        }

        const newG = g + weight;
        const prevG = gCosts.get(neighbor);
        const wasClosed = closed.has(neighbor);
        const wasStored = open.has(neighbor) || wasClosed;

        if (!wasStored) {
          pValues.set(neighbor, initializePValue(neighbor, current));
        }

        if (prevG !== undefined && newG >= prevG) {
          continue;
        }

        const neighborH = h(neighbor);
        const neighborF = newG + neighborH;

        gCosts.set(neighbor, newG);
        hCosts.set(neighbor, neighborH);
        fCosts.set(neighbor, neighborF);
        denseParentMap.set(neighbor, current);
        sparseParentMap.set(neighbor, current);
        if (neighbor !== problem.startNode) {
          relayNodes.delete(neighbor);
        }

        if (wasClosed) {
          closed.delete(neighbor);
        }
        open.add(neighbor);
        pq.push(neighbor, neighborF);

        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `${wasClosed ? 'Reopened' : 'Inserted'} "${labelOf(neighbor)}" with g=${newG}, h=${neighborH}, f=${neighborF}${wasClosed ? ' after finding a better path' : ''}.`,
          pseudocodeLine: 7,
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
            { label: 'Memory', value: open.size + closed.size, color: 'text-[var(--text-2)]' },
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
      pseudocodeLine: 10,
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
        { label: 'Relay', value: relayNodes.size, color: 'text-[#3FB950]' },
        { label: 'Memory', value: open.size + closed.size, color: 'text-[var(--text-2)]' },
      ],
      logs: [createLog('FAILURE: SMGS exhausted OPEN without reaching the goal', 'error')],
      statePanels: buildPanels(),
    };
  },
};
