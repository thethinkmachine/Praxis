import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, buildAdjacencyList, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { deepClone } from '@/lib/deep-clone';

interface IDAStarState {
  frontier: string[];       // nodes on the current DFS path (call stack)
  explored: Set<string>;    // all nodes visited across all iterations
  pathMap: Map<string, string | null>;
  foundPath: string[] | null;
  gCosts: Map<string, number>;
  hCosts: Map<string, number>;
  fCosts: Map<string, number>;
  threshold: number;
  iteration: number;
}

export const idaStarRunner: AlgorithmRunner<GraphProblem, IDAStarState, SearchHighlight> = {
  meta: {
    id: 'ida-star',
    name: 'IDA* Search',
    shortName: 'IDA*',
    category: 'informed-search',
    description:
      'Iterative-deepening A*. Performs successive DFS passes, each pruning nodes whose f(n) = g(n)+h(n) exceeds a threshold. Starts at h(start), then raises the threshold to the minimum pruned f-value. Complete and optimal with an admissible heuristic; uses only O(bd) memory.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(bd)',
    complete: true,
    optimal: true,
    tags: ['search', 'informed', 'heuristic', 'iterative-deepening', 'optimal', 'memory-efficient'],
    bookChapter: 'AIMA 4th Ed. § 3.5.3',
    relatedAlgorithms: ['astar', 'iddfs'],
    relationshipLabel: 'like IDDFS but with f-cost threshold',
  },

  pseudocode: [
    'function IDA-STAR(problem):',
    '  threshold ← h(problem.INITIAL)',
    '  path ← [problem.INITIAL]',
    '  loop:',
    '    result ← SEARCH(path, g=0, threshold)',
    '    if result = FOUND: return path',
    '    if result = ∞: return failure',
    '    threshold ← result  // next min exceeded f',
    '',
    'function SEARCH(path, g, threshold):',
    '  current ← path.last',
    '  f ← g + h(current)',
    '  if f > threshold: return f  // prune',
    '  if IS-GOAL(current): return FOUND',
    '  min_next ← ∞',
    '  for each child of current (not in path):',
    '    path.push(child)',
    '    result ← SEARCH(path, g + cost(current, child), threshold)',
    '    if result = FOUND: return FOUND',
    '    if result < min_next: min_next ← result',
    '    path.pop()',
    '  return min_next',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    return {
      ...base,
      warnings: [...base.warnings, ...getHeuristicValidationWarnings(problem)],
    };
  },

  getInitialState(problem: GraphProblem): IDAStarState {
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
      threshold: h0,
      iteration: 1,
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<IDAStarState, SearchHighlight>, void> {
    const adj = buildAdjacencyList(problem.graph);
    const labelOf = (id: string) => problem.graph.nodes.find(n => n.id === id)?.label ?? id;
    const h = createHeuristicEvaluator(problem);

    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>();
    const hCosts = new Map<string, number>();
    const fCosts = new Map<string, number>();
    const allExplored = new Set<string>(); // across all iterations

    let threshold = h(problem.startNode);
    let iteration = 1;
    let nodesExpanded = 0;
    let stepNum = 0;

    gCosts.set(problem.startNode, 0);
    hCosts.set(problem.startNode, h(problem.startNode));
    fCosts.set(problem.startNode, h(problem.startNode));

    const snap = (currentPath: string[]): IDAStarState => ({
      frontier: [...currentPath],
      explored: deepClone(allExplored),
      pathMap: deepClone(pathMap),
      foundPath: null,
      gCosts: deepClone(gCosts),
      hCosts: deepClone(hCosts),
      fCosts: deepClone(fCosts),
      threshold,
      iteration,
    });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `IDA* initialized. Start="${labelOf(problem.startNode)}", initial threshold f=${threshold}`,
      pseudocodeLine: 0,
      state: snap([problem.startNode]),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: { nodesExpanded: 0, frontierSize: 1, currentDepth: 0, pathCost: 0, hCost: threshold, fCost: threshold, memoryUsed: 1 },
    };

    // Outer loop: iterate over thresholds
    while (true) {
      // One DFS pass with the current threshold.
      // Iterative simulation using an explicit call stack.
      // Each frame: { node, g, childIdx, children }
      type Frame = {
        node: string;
        g: number;
        childIdx: number;
        children: { neighbor: string; weight: number }[];
      };

      const callStack: Frame[] = [{
        node: problem.startNode,
        g: 0,
        childIdx: 0,
        children: adj.get(problem.startNode) ?? [],
      }];

      const currentPath = new Set<string>([problem.startNode]);
      let nextThreshold = Infinity;
      let found = false;

      // Track current DFS path as array for snap
      const pathArr: string[] = [problem.startNode];

      while (callStack.length > 0) {
        const frame = callStack[callStack.length - 1];
        const g = frame.g;
        const hVal = h(frame.node);
        const fVal = g + hVal;

        // First time visiting this frame (childIdx === 0): decide prune vs visit
        if (frame.childIdx === 0) {
          gCosts.set(frame.node, g);
          hCosts.set(frame.node, hVal);
          fCosts.set(frame.node, fVal);

          if (fVal > threshold) {
            // Prune
            nextThreshold = Math.min(nextThreshold, fVal);
            callStack.pop();
            currentPath.delete(frame.node);
            pathArr.pop();

            yield {
              stepNumber: stepNum++,
              phase: 'pruning',
              description: `Pruned "${labelOf(frame.node)}" — f=${fVal} > threshold=${threshold}`,
              pseudocodeLine: 12,
              state: snap(pathArr),
              highlight: {
                frontierNodes: new Set(pathArr.slice(0, -1)),
                exploredNodes: deepClone(allExplored),
                currentNode: frame.node,
                pathEdges: null,
              },
              metrics: { nodesExpanded, frontierSize: callStack.length, currentDepth: pathArr.length, pathCost: g, hCost: hVal, fCost: fVal, memoryUsed: callStack.length + allExplored.size },
            };
            continue;
          }

          allExplored.add(frame.node);
          nodesExpanded++;

          if (frame.node === problem.goalNode) {
            // Reconstruct path from pathMap
            const foundPath = reconstructPath(pathMap, frame.node);
            found = true;
            yield {
              stepNumber: stepNum++,
              phase: 'found',
              description: `Goal "${labelOf(problem.goalNode)}" found! Optimal cost: ${g}`,
              pseudocodeLine: 13,
              state: { ...snap(pathArr), foundPath },
              highlight: {
                frontierNodes: new Set(),
                exploredNodes: deepClone(allExplored),
                currentNode: frame.node,
                pathEdges: foundPath,
              },
              metrics: { nodesExpanded, frontierSize: 0, currentDepth: foundPath.length - 1, pathCost: g, hCost: 0, fCost: g, memoryUsed: allExplored.size },
            };
            return;
          }

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `Visiting "${labelOf(frame.node)}" — g=${g}, h=${hVal}, f=${fVal}, threshold=${threshold}`,
            pseudocodeLine: 10,
            state: snap(pathArr),
            highlight: {
              frontierNodes: new Set(pathArr.slice(0, -1)),
              exploredNodes: deepClone(allExplored),
              currentNode: frame.node,
              pathEdges: null,
            },
            metrics: { nodesExpanded, frontierSize: callStack.length, currentDepth: pathArr.length - 1, pathCost: g, hCost: hVal, fCost: fVal, memoryUsed: callStack.length + allExplored.size },
          };
        }

        // Advance to next unvisited child
        let pushed = false;
        while (frame.childIdx < frame.children.length) {
          const { neighbor, weight } = frame.children[frame.childIdx];
          frame.childIdx++;

          if (!currentPath.has(neighbor)) {
            pathMap.set(neighbor, frame.node);
            currentPath.add(neighbor);
            pathArr.push(neighbor);
            callStack.push({
              node: neighbor,
              g: g + weight,
              childIdx: 0,
              children: adj.get(neighbor) ?? [],
            });
            pushed = true;
            break;
          }
        }

        if (!pushed) {
          // All children done — backtrack
          callStack.pop();
          currentPath.delete(frame.node);
          pathArr.pop();

          if (callStack.length > 0) {
            yield {
              stepNumber: stepNum++,
              phase: 'backtracking',
              description: `Backtracking from "${labelOf(frame.node)}"`,
              pseudocodeLine: 20,
              state: snap(pathArr),
              highlight: {
                frontierNodes: new Set(pathArr),
                exploredNodes: deepClone(allExplored),
                currentNode: pathArr[pathArr.length - 1] ?? null,
                pathEdges: null,
              },
              metrics: { nodesExpanded, frontierSize: callStack.length, currentDepth: pathArr.length - 1, pathCost: callStack[callStack.length - 1]?.g ?? 0, hCost: hVal, fCost: fVal, memoryUsed: callStack.length + allExplored.size },
            };
          }
        }
      }

      if (found) return;

      if (nextThreshold === Infinity) {
        yield {
          stepNumber: stepNum++,
          phase: 'failed',
          description: 'IDA* failed — no path exists.',
          pseudocodeLine: 6,
          state: snap([]),
          highlight: { frontierNodes: new Set(), exploredNodes: deepClone(allExplored), currentNode: null, pathEdges: null },
          metrics: { nodesExpanded, frontierSize: 0, currentDepth: 0, pathCost: Infinity, memoryUsed: allExplored.size },
        };
        return;
      }

      // Start next iteration with raised threshold
      threshold = nextThreshold;
      iteration++;

      yield {
        stepNumber: stepNum++,
        phase: 'initializing',
        description: `Iteration ${iteration}: raising threshold to f = ${threshold}`,
        pseudocodeLine: 7,
        state: snap([problem.startNode]),
        highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: deepClone(allExplored), currentNode: null, pathEdges: null },
        metrics: { nodesExpanded, frontierSize: 1, currentDepth: 0, pathCost: 0, hCost: h(problem.startNode), fCost: threshold, memoryUsed: allExplored.size },
      };
    }
  },
};
