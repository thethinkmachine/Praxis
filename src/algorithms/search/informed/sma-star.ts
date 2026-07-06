import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { deepClone } from '@/lib/deep-clone';
import { compareLabels } from '@/lib/natural-sort';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

export interface SMAStarProblem extends GraphProblem {
  /**
   * Maximum number of states retained in memory.
   * Lower values force aggressive pruning of least-promising leaves.
   */
  memoryLimit?: number;
}

interface SMAStarState extends InformedSearchState {
  memoryLimit: number;
  prunedNodes: number;
  openSet: string[];
}

interface SMARecord {
  id: string;
  g: number;
  h: number;
  f: number;
  depth: number;
  parent: string | null;
  children: Set<string>;
  generated: boolean;
  forgottenBestF: number;
  inOpen: boolean;
}

export const smaStarRunner: AlgorithmRunner<SMAStarProblem, SMAStarState, SearchHighlight> = {
  meta: {
    id: 'sma-star',
    name: 'Simplified Memory-Bounded A*',
    shortName: 'SMA*',
    category: 'informed-search',
    description:
      'A* variant that obeys a fixed memory limit. When memory fills, it drops the worst frontier leaf and backs up that leaf\'s f-cost to its parent so the branch can be regenerated later if needed.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(M)',
    complete: 'Complete if memory can hold the shallowest solution path',
    optimal: 'Optimal if memory can retain all nodes on an optimal path',
    tags: ['search', 'informed', 'heuristic', 'memory-bounded', 'optimal', 'best-first'],
    bookChapter: 'AIMA 4th Ed. § 3.5.5',
    relatedAlgorithms: ['astar', 'rbfs', 'ida-star'],
  },

  pseudocode: [
    'function SMA-STAR(problem, M):',
    '  open ← {start}',
    '  while open not empty:',
    '    best ← leaf in open with smallest f',
    '    if IS-GOAL(best): return solution(best)',
    '    expand best and compute child f-values',
    '    if memory > M: remove worst leaf',
    '    backup removed leaf f to parent',
    '    if parent has no children in memory: reinsert parent as leaf',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    const warnings = [...base.warnings, ...getHeuristicValidationWarnings(problem)];
    const errors = [...base.errors];
    if (problem.memoryLimit !== undefined && (!Number.isFinite(problem.memoryLimit) || problem.memoryLimit < 2)) {
      errors.push('SMA* memoryLimit must be at least 2.');
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  getInitialState(problem: SMAStarProblem): SMAStarState {
    const h = createHeuristicEvaluator(problem);
    const h0 = h(problem.startNode);
    const memoryLimit = Math.max(2, Math.floor(problem.memoryLimit ?? 64));
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
    };
  },

  *run(problem: SMAStarProblem): Generator<AlgorithmStep<SMAStarState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const h = createHeuristicEvaluator(problem);
    const memoryLimit = Math.max(2, Math.floor(problem.memoryLimit ?? 64));

    const records = new Map<string, SMARecord>();
    const open = new Set<string>();
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>();
    const hCosts = new Map<string, number>();
    const fCosts = new Map<string, number>();

    let nodesExpanded = 0;
    let stepNum = 0;
    let prunedNodes = 0;

    const startH = h(problem.startNode);
    const startNode: SMARecord = {
      id: problem.startNode,
      g: 0,
      h: startH,
      f: startH,
      depth: 0,
      parent: null,
      children: new Set(),
      generated: false,
      forgottenBestF: Infinity,
      inOpen: true,
    };
    records.set(problem.startNode, startNode);
    open.add(problem.startNode);
    gCosts.set(problem.startNode, 0);
    hCosts.set(problem.startNode, startH);
    fCosts.set(problem.startNode, startH);

    const openList = (): string[] => {
      return [...open].sort((a, b) => {
        const ra = records.get(a);
        const rb = records.get(b);
        const fa = ra?.f ?? Infinity;
        const fb = rb?.f ?? Infinity;
        if (fa !== fb) return fa - fb;
        const da = ra?.depth ?? 0;
        const db = rb?.depth ?? 0;
        if (da !== db) return db - da; // deeper node first on tie
        return compareLabels(labelOf(a), labelOf(b));
      });
    };

    const selectBestLeaf = (): SMARecord | null => {
      const id = openList()[0];
      return id ? (records.get(id) ?? null) : null;
    };

    const selectWorstLeaf = (): SMARecord | null => {
      const leaves = openList();
      for (let i = leaves.length - 1; i >= 0; i--) {
        const rec = records.get(leaves[i]);
        if (!rec) continue;
        if (rec.parent === null) continue; // keep root resident
        return rec;
      }
      return null;
    };

    const isAncestor = (ancestorId: string, nodeId: string): boolean => {
      let cur: string | null = nodeId;
      while (cur !== null) {
        if (cur === ancestorId) return true;
        cur = records.get(cur)?.parent ?? null;
      }
      return false;
    };

    const recalcNodeF = (id: string): void => {
      const rec = records.get(id);
      if (!rec) return;
      if (!rec.generated) {
        fCosts.set(id, rec.f);
        return;
      }
      let nextF = rec.forgottenBestF;
      for (const childId of rec.children) {
        const child = records.get(childId);
        if (!child) continue;
        nextF = Math.min(nextF, child.f);
      }
      rec.f = nextF;
      fCosts.set(id, rec.f);
    };

    const bubbleUp = (fromId: string): void => {
      let cur = records.get(fromId)?.parent ?? null;
      while (cur !== null) {
        const parent = records.get(cur);
        if (!parent) break;
        const prev = parent.f;
        recalcNodeF(cur);
        // If all children are forgotten, parent becomes an open leaf again.
        if (parent.generated && parent.children.size === 0 && !parent.inOpen) {
          parent.inOpen = true;
          open.add(cur);
        }
        if (parent.f === prev) {
          cur = parent.parent;
          continue;
        }
        cur = parent.parent;
      }
    };

    const removeSubtree = (id: string): void => {
      const rec = records.get(id);
      if (!rec) return;
      for (const childId of [...rec.children]) {
        removeSubtree(childId);
      }
      open.delete(id);
      records.delete(id);
      gCosts.delete(id);
      hCosts.delete(id);
      fCosts.delete(id);
      if (id !== problem.startNode) pathMap.delete(id);
    };

    const pruneWorstLeaf = (): SMARecord | null => {
      const worst = selectWorstLeaf();
      if (!worst) return null;

      const parentId = worst.parent;
      const parent = parentId ? records.get(parentId) : null;
      if (!parent) return null;

      parent.children.delete(worst.id);
      parent.forgottenBestF = Math.min(parent.forgottenBestF, worst.f);

      removeSubtree(worst.id);
      prunedNodes++;

      if (parent.generated && parent.children.size === 0 && !parent.inOpen) {
        parent.f = parent.forgottenBestF;
        fCosts.set(parent.id, parent.f);
        parent.inOpen = true;
        open.add(parent.id);
      }

      bubbleUp(parent.id);
      return worst;
    };

    const snap = (foundPath: string[] | null = null): SMAStarState => ({
      frontier: openList(),
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath,
      gCosts: deepClone(gCosts),
      hCosts: deepClone(hCosts),
      fCosts: deepClone(fCosts),
      memoryLimit,
      prunedNodes,
      openSet: openList(),
    });
    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) =>
      buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Frontier (Open Set)', items: openList(), variant: 'frontier' },
          { title: 'Explored', items: explored, variant: 'explored' },
        ],
      });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `SMA* initialized. Start="${labelOf(problem.startNode)}", memory limit M=${memoryLimit}`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: {
        frontierNodes: new Set([problem.startNode]),
        exploredNodes: new Set(),
        currentNode: null,
        pathEdges: null,
      },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'g(n)', value: 0, color: 'text-[var(--warning)]' }, { label: 'h(n)', value: startH, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: startH, color: 'text-[var(--accent)]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized SMA* with memory limit ${memoryLimit}`, 'info')],
      statePanels: buildPanels()
    };

    while (open.size > 0) {
      const best = selectBestLeaf();
      if (!best) break;

      open.delete(best.id);
      best.inOpen = false;
      explored.add(best.id);
      nodesExpanded++;

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding best leaf "${labelOf(best.id)}" — g=${best.g}, h=${best.h}, f=${best.f}`,
        pseudocodeLine: 3,
        state: snap(),
        highlight: {
          frontierNodes: new Set(openList()),
          exploredNodes: deepClone(explored),
          currentNode: best.id,
          pathEdges: null,
        },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: best.depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: best.g, color: 'text-[#3FB950]' }, { label: 'g(n)', value: best.g, color: 'text-[var(--warning)]' }, { label: 'h(n)', value: best.h, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: best.f, color: 'text-[var(--accent)]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding ${labelOf(best.id)} from SMA* frontier`, 'info')],
          statePanels: buildPanels(best.id)
    };

      if (best.id === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, best.id);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found by SMA* with cost ${best.g}`,
          pseudocodeLine: 4,
          state: snap(foundPath),
          highlight: {
            frontierNodes: new Set(),
            exploredNodes: deepClone(explored),
            currentNode: best.id,
            pathEdges: foundPath,
          },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: foundPath.length - 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: best.g, color: 'text-[#3FB950]' }, { label: 'g(n)', value: best.g, color: 'text-[var(--warning)]' }, { label: 'h(n)', value: 0, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: best.g, color: 'text-[var(--accent)]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Goal reached with cost ${best.g}`, 'success')],
            statePanels: buildPanels(best.id, foundPath)
        };
        return;
      }

      best.generated = true;
      best.children.clear();

      let generatedCount = 0;
      for (const { neighbor, weight } of adj.get(best.id) ?? []) {
        if (isAncestor(neighbor, best.id)) continue;

        const newG = best.g + weight;
        const existing = records.get(neighbor);
        if (existing && newG >= existing.g) {
          continue;
        }

        if (existing) {
          const oldParent = existing.parent ? records.get(existing.parent) : null;
          if (oldParent) {
            oldParent.children.delete(neighbor);
          }
          removeSubtree(neighbor);
        }

        const neighborH = h(neighbor);
        const neighborF = Math.max(newG + neighborH, best.f); // pathmax-like backup
        const child: SMARecord = {
          id: neighbor,
          g: newG,
          h: neighborH,
          f: neighborF,
          depth: best.depth + 1,
          parent: best.id,
          children: new Set(),
          generated: false,
          forgottenBestF: Infinity,
          inOpen: true,
        };

        records.set(neighbor, child);
        open.add(neighbor);
        best.children.add(neighbor);
        generatedCount++;

        pathMap.set(neighbor, best.id);
        gCosts.set(neighbor, newG);
        hCosts.set(neighbor, neighborH);
        fCosts.set(neighbor, neighborF);

        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `Generated child "${labelOf(neighbor)}" from "${labelOf(best.id)}" — g=${newG}, h=${neighborH}, f=${neighborF}`,
          pseudocodeLine: 5,
          state: snap(),
          highlight: {
            frontierNodes: new Set(openList()),
            exploredNodes: deepClone(explored),
            currentNode: best.id,
            pathEdges: null,
          },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: child.depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: newG, color: 'text-[#3FB950]' }, { label: 'g(n)', value: newG, color: 'text-[var(--warning)]' }, { label: 'h(n)', value: neighborH, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: neighborF, color: 'text-[var(--accent)]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`Generated ${labelOf(neighbor)} for SMA* frontier`, 'info')],
            statePanels: buildPanels(best.id)
        };
      }

      if (generatedCount === 0) {
        best.f = Infinity;
        fCosts.set(best.id, Infinity);
        best.inOpen = true;
        open.add(best.id);

        yield {
          stepNumber: stepNum++,
          phase: 'pruning',
          description: `Dead-end leaf "${labelOf(best.id)}" assigned f=∞.`,
          pseudocodeLine: 7,
          state: snap(),
          highlight: {
            frontierNodes: new Set(openList()),
            exploredNodes: deepClone(explored),
            currentNode: best.id,
            pathEdges: null,
          },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: best.depth, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: best.g, color: 'text-[#3FB950]' }, { label: 'g(n)', value: best.g, color: 'text-[var(--warning)]' }, { label: 'h(n)', value: best.h, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: Infinity, color: 'text-[var(--accent)]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`Dead-end at ${labelOf(best.id)}; backed up as f=∞`, 'warn')],
            statePanels: buildPanels(best.id)
        };
      } else {
        recalcNodeF(best.id);
      }

      bubbleUp(best.id);

      while (records.size > memoryLimit) {
        const pruned = pruneWorstLeaf();
        if (!pruned) break;

        yield {
          stepNumber: stepNum++,
          phase: 'pruning',
          description: `Memory bound exceeded (M=${memoryLimit}). Pruned worst leaf "${labelOf(pruned.id)}" with f=${pruned.f}`,
          pseudocodeLine: 6,
          state: snap(),
          highlight: {
            frontierNodes: new Set(openList()),
            exploredNodes: deepClone(explored),
            currentNode: pruned.parent,
            pathEdges: null,
          },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: open.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: records.get(pruned.parent ?? '')?.depth ?? 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: records.get(pruned.parent ?? '')?.g ?? 0, color: 'text-[#3FB950]' }, { label: 'f(n)', value: pruned.f, color: 'text-[var(--accent)]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`Pruned worst leaf ${labelOf(pruned.id)} to respect memory limit`, 'warn')],
            statePanels: buildPanels(pruned.parent)
        };
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'SMA* failed — no path exists under current memory bound.',
      pseudocodeLine: 9,
      state: snap(),
      highlight: {
        frontierNodes: new Set(),
        exploredNodes: deepClone(explored),
        currentNode: null,
        pathEdges: null,
      },
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: records.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: Frontier exhausted before reaching goal', 'error')],
      statePanels: buildPanels()
    };
  },
};
