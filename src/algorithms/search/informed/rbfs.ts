import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { validateGraphProblem, reconstructPath, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { deepClone } from '@/lib/deep-clone';
import { createLog } from '@/algorithms/core/utils';

interface RBFSState extends InformedSearchState {
  frontierStack: string[];
  fLimit: number;
}

type RbfsResult = { found: true; goal: string } | { found: false; nextF: number };

export const rbfsRunner: AlgorithmRunner<GraphProblem, RBFSState, SearchHighlight> = {
  meta: {
    id: 'rbfs',
    name: 'Recursive Best-First Search',
    shortName: 'RBFS',
    category: 'informed-search',
    description:
      'Memory-efficient best-first search that follows the most promising f(n)=g(n)+h(n) path and backtracks with updated alternative bounds instead of storing the full frontier.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(bd)',
    complete: true,
    optimal: true,
    tags: ['search', 'informed', 'heuristic', 'memory-efficient', 'best-first', 'recursive'],
    bookChapter: 'AIMA 4th Ed. § 3.5.4',
    relatedAlgorithms: ['astar', 'ida-star', 'sma-star'],
  },

  pseudocode: [
    'function RBFS(problem):',
    '  start.g ← 0',
    '  start.f ← h(start)',
    '  return RBFS-SEARCH(start, f_limit=∞)',
    '',
    'function RBFS-SEARCH(node, f_limit):',
    '  if IS-GOAL(node): return node',
    '  successors ← EXPAND(node)',
    '  if successors is empty: return failure, ∞',
    '  for each s in successors:',
    '    s.f ← max(s.g + h(s), node.f)  // pathmax',
    '  loop:',
    '    best ← successor with lowest f',
    '    if best.f > f_limit: return failure, best.f',
    '    alternative ← second-lowest f among successors',
    '    result, best.f ← RBFS-SEARCH(best, min(f_limit, alternative))',
    '    if result ≠ failure: return result',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    return {
      ...base,
      warnings: [...base.warnings, ...getHeuristicValidationWarnings(problem)],
    };
  },

  getInitialState(problem: GraphProblem): RBFSState {
    const h = createHeuristicEvaluator(problem);
    const h0 = h(problem.startNode);
    return {
      frontier: [problem.startNode],
      explored: new Set(),
      pathMap: new Map([[problem.startNode, null]]),
      foundPath: null,
      gCosts: new Map([[problem.startNode, 0]]),
      hCosts: new Map([[problem.startNode, h0]]),
      fCosts: new Map([[problem.startNode, h0]]),
      frontierStack: [problem.startNode],
      fLimit: Infinity,
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<RBFSState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const labelOf = (id: string) => problem.graph.nodes.find(n => n.id === id)?.label ?? id;
    const h = createHeuristicEvaluator(problem);

    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const fCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);

    const stack: string[] = [problem.startNode];
    let nodesExpanded = 0;
    let stepNum = 0;

    const snap = (fLimit: number, foundPath: string[] | null = null): RBFSState => ({
      frontier: [...stack],
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath,
      gCosts: deepClone(gCosts),
      hCosts: deepClone(hCosts),
      fCosts: deepClone(fCosts),
      frontierStack: [...stack],
      fLimit,
    });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `RBFS initialized. Start="${labelOf(problem.startNode)}", f=${h(problem.startNode)}`,
      pseudocodeLine: 0,
      state: snap(Infinity),
      highlight: {
        frontierNodes: new Set([problem.startNode]),
        exploredNodes: new Set(),
        currentNode: null,
        pathEdges: null,
      },
      metrics: {
        nodesExpanded: 0,
        frontierSize: 1,
        currentDepth: 0,
        pathCost: 0,
        hCost: h(problem.startNode),
        fCost: h(problem.startNode),
        memoryUsed: 1,
      },
      logs: [createLog(`Initialized RBFS at node ${labelOf(problem.startNode)}`, 'info')],
    };

    type Successor = {
      id: string;
      g: number;
      h: number;
      f: number;
    };

    const rbfs = function* (
      node: string,
      g: number,
      nodeF: number,
      fLimit: number,
      pathSet: Set<string>,
    ): Generator<AlgorithmStep<RBFSState, SearchHighlight>, RbfsResult, void> {
      explored.add(node);
      nodesExpanded++;

      const nodeH = h(node);
      const effectiveF = Math.max(nodeF, g + nodeH);
      gCosts.set(node, g);
      hCosts.set(node, nodeH);
      fCosts.set(node, effectiveF);

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(node)}" with f-limit=${Number.isFinite(fLimit) ? fLimit : '∞'} (g=${g}, h=${nodeH}, f=${effectiveF})`,
        pseudocodeLine: 5,
        state: snap(fLimit),
        highlight: {
          frontierNodes: new Set(stack),
          exploredNodes: deepClone(explored),
          currentNode: node,
          pathEdges: null,
        },
        metrics: {
          nodesExpanded,
          frontierSize: stack.length,
          currentDepth: stack.length - 1,
          pathCost: g,
          gCost: g,
          hCost: nodeH,
          fCost: effectiveF,
          memoryUsed: stack.length + explored.size,
        },
        logs: [createLog(`Expanding ${labelOf(node)} with f-limit=${Number.isFinite(fLimit) ? fLimit : '∞'}`, 'info')],
      };

      if (node === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, node);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found by RBFS with cost ${g}`,
          pseudocodeLine: 6,
          state: snap(fLimit, foundPath),
          highlight: {
            frontierNodes: new Set(),
            exploredNodes: deepClone(explored),
            currentNode: node,
            pathEdges: foundPath,
          },
          metrics: {
            nodesExpanded,
            frontierSize: 0,
            currentDepth: foundPath.length - 1,
            pathCost: g,
            gCost: g,
            hCost: 0,
            fCost: g,
            memoryUsed: explored.size,
          },
          logs: [createLog(`SUCCESS: Goal reached with path cost ${g}`, 'success')],
        };
        return { found: true, goal: node };
      }

      const successors: Successor[] = [];
      for (const { neighbor, weight } of adj.get(node) ?? []) {
        if (pathSet.has(neighbor)) continue;

        const newG = g + weight;

        const neighborH = h(neighbor);
        const neighborF = Math.max(newG + neighborH, effectiveF); // pathmax correction
        pathMap.set(neighbor, node);
        gCosts.set(neighbor, newG);
        hCosts.set(neighbor, neighborH);
        fCosts.set(neighbor, neighborF);

        successors.push({ id: neighbor, g: newG, h: neighborH, f: neighborF });

        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `Generated successor "${labelOf(neighbor)}" — g=${newG}, h=${neighborH}, f=${neighborF}`,
          pseudocodeLine: 10,
          state: snap(fLimit),
          highlight: {
            frontierNodes: new Set([...stack, neighbor]),
            exploredNodes: deepClone(explored),
            currentNode: node,
            pathEdges: null,
          },
          metrics: {
            nodesExpanded,
            frontierSize: stack.length + 1,
            currentDepth: stack.length,
            pathCost: newG,
            gCost: newG,
            hCost: neighborH,
            fCost: neighborF,
            memoryUsed: stack.length + explored.size + 1,
          },
          logs: [createLog(`Generated ${labelOf(neighbor)} (f=${neighborF})`, 'info')],
        };
      }

      if (successors.length === 0) {
        yield {
          stepNumber: stepNum++,
          phase: 'pruning',
          description: `Dead end at "${labelOf(node)}" — no admissible successors.`,
          pseudocodeLine: 8,
          state: snap(fLimit),
          highlight: {
            frontierNodes: new Set(stack.slice(0, -1)),
            exploredNodes: deepClone(explored),
            currentNode: node,
            pathEdges: null,
          },
          metrics: {
            nodesExpanded,
            frontierSize: stack.length,
            currentDepth: stack.length - 1,
            pathCost: g,
            gCost: g,
            hCost: nodeH,
            fCost: Infinity,
            memoryUsed: stack.length + explored.size,
          },
          logs: [createLog(`Dead end at ${labelOf(node)}; returning ∞`, 'warn')],
        };
        return { found: false, nextF: Infinity };
      }

      while (true) {
        successors.sort((a, b) => a.f - b.f || labelOf(a.id).localeCompare(labelOf(b.id)));
        const best = successors[0];
        const alternative = successors.length > 1 ? successors[1].f : Infinity;

        if (best.f > fLimit || (!Number.isFinite(best.f) && !Number.isFinite(fLimit))) {
          yield {
            stepNumber: stepNum++,
            phase: 'pruning',
            description: `Pruning branch at "${labelOf(node)}": best successor f=${best.f} exceeds limit ${fLimit}`,
            pseudocodeLine: 13,
            state: snap(fLimit),
            highlight: {
              frontierNodes: new Set(stack),
              exploredNodes: deepClone(explored),
              currentNode: node,
              pathEdges: null,
            },
            metrics: {
              nodesExpanded,
              frontierSize: stack.length,
              currentDepth: stack.length - 1,
              pathCost: g,
              gCost: g,
              hCost: nodeH,
              fCost: best.f,
              memoryUsed: stack.length + explored.size,
            },
            logs: [createLog(`Pruned at ${labelOf(node)}: best f=${best.f} > limit ${fLimit}`, 'warn')],
          };
          return { found: false, nextF: best.f };
        }

        const childLimit = Math.min(fLimit, alternative);
        stack.push(best.id);
        pathSet.add(best.id);

        yield {
          stepNumber: stepNum++,
          phase: 'visiting',
          description: `Descending to best successor "${labelOf(best.id)}" with child limit ${Number.isFinite(childLimit) ? childLimit : '∞'}`,
          pseudocodeLine: 15,
          state: snap(childLimit),
          highlight: {
            frontierNodes: new Set(stack),
            exploredNodes: deepClone(explored),
            currentNode: best.id,
            pathEdges: null,
          },
          metrics: {
            nodesExpanded,
            frontierSize: stack.length,
            currentDepth: stack.length - 1,
            pathCost: best.g,
            gCost: best.g,
            hCost: best.h,
            fCost: best.f,
            memoryUsed: stack.length + explored.size,
          },
          logs: [createLog(`RBFS descending to ${labelOf(best.id)} with limit ${Number.isFinite(childLimit) ? childLimit : '∞'}`, 'info')],
        };

        const result = yield* rbfs(best.id, best.g, best.f, childLimit, pathSet);
        stack.pop();
        pathSet.delete(best.id);

        if (result.found) {
          return result;
        }

        best.f = result.nextF;
        fCosts.set(best.id, best.f);

        yield {
          stepNumber: stepNum++,
          phase: 'backtracking',
          description: `Backtracking to "${labelOf(node)}"; revised f("${labelOf(best.id)}")=${best.f}`,
          pseudocodeLine: 16,
          state: snap(fLimit),
          highlight: {
            frontierNodes: new Set(stack),
            exploredNodes: deepClone(explored),
            currentNode: node,
            pathEdges: null,
          },
          metrics: {
            nodesExpanded,
            frontierSize: stack.length,
            currentDepth: stack.length - 1,
            pathCost: g,
            gCost: g,
            hCost: nodeH,
            fCost: best.f,
            memoryUsed: stack.length + explored.size,
          },
          logs: [createLog(`Backtracked to ${labelOf(node)}; child ${labelOf(best.id)} now has f=${best.f}`, 'info')],
        };
      }
    };

    const startF = h(problem.startNode);
    const result = yield* rbfs(problem.startNode, 0, startF, Infinity, new Set([problem.startNode]));

    if (result.found) return;

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'RBFS failed — no path exists.',
      pseudocodeLine: 16,
      state: snap(Infinity),
      highlight: {
        frontierNodes: new Set(),
        exploredNodes: deepClone(explored),
        currentNode: null,
        pathEdges: null,
      },
      metrics: {
        nodesExpanded,
        frontierSize: 0,
        currentDepth: 0,
        pathCost: Infinity,
        memoryUsed: explored.size,
      },
      logs: [createLog('FAILURE: No path exists to the goal node', 'error')],
    };
  },
};
