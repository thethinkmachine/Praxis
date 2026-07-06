import type { AlgorithmRunner } from '@/types/algorithm';
import type { GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { InformedSearchState, SearchHighlight } from './types';
import { reconstructPath, validateGraphProblem, createHeuristicEvaluator, getHeuristicValidationWarnings } from './types';
import { PriorityQueue } from '@/lib/priority-queue';
import { deepClone } from '@/lib/deep-clone';
import { compareLabels } from '@/lib/natural-sort';
import { createLog, buildGraphStatePanels } from '@/algorithms/core/utils';

export const astarRunner: AlgorithmRunner<GraphProblem, InformedSearchState, SearchHighlight> = {
  meta: {
    id: 'astar',
    name: 'A* Search',
    shortName: 'A*',
    category: 'informed-search',
    description:
      'Expands nodes in order of f(n) = g(n) + h(n), balancing path cost and heuristic estimate. With an admissible heuristic A* is both complete and optimal, and typically explores far fewer nodes than UCS.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(b^d)',
    complete: true,
    optimal: true,
    tags: ['search', 'informed', 'heuristic', 'priority-queue', 'optimal', 'complete'],
    bookChapter: 'AIMA 4th Ed. § 3.5.2',
    relatedAlgorithms: ['ucs', 'greedy-bfs', 'weighted-astar', 'ida-star'],
    relationshipLabel: 'extends UCS with heuristic',
  },

  pseudocode: [
    'function A-STAR(problem):',
    '  node ← Node(problem.INITIAL, g=0, f=h(INITIAL))',
    '  frontier ← priority queue ordered by f(n)',
    '  frontier.add(node)',
    '  reached ← {problem.INITIAL: node}',
    '  while frontier is not empty:',
    '    node ← POP(frontier)  // lowest f(n) = g(n) + h(n)',
    '    if IS-GOAL(node.STATE): return node',
    '    for each child in EXPAND(problem, node):',
    '      s ← child.STATE',
    '      new_g ← node.g + step_cost(node, s)',
    '      if s not in reached or new_g < reached[s].g:',
    '        reached[s] ← child',
    '        frontier.push(child, new_g + h(s))',
    '  return failure',
  ],

  validate(problem) {
    const base = validateGraphProblem(problem, { requireNonNegativeWeights: true });
    return {
      ...base,
      warnings: [...base.warnings, ...getHeuristicValidationWarnings(problem)],
    };
  },

  getInitialState(problem: GraphProblem): InformedSearchState {
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
    };
  },

  *run(problem: GraphProblem): Generator<AlgorithmStep<InformedSearchState, SearchHighlight>, void> {
    const adj = problem.graph.toAdjList();
    const nodeLabelMap = new Map(problem.graph.nodes.map(n => [n.id, n.label ?? n.id]));
    const labelOf = (id: string) => nodeLabelMap.get(id) ?? id;
    const h = createHeuristicEvaluator(problem);

    const pq = new PriorityQueue<string>((a, b) => compareLabels(labelOf(a), labelOf(b)));
    const explored = new Set<string>();
    const pathMap = new Map<string, string | null>([[problem.startNode, null]]);
    const gCosts = new Map<string, number>([[problem.startNode, 0]]);
    const hCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    const fCosts = new Map<string, number>([[problem.startNode, h(problem.startNode)]]);
    let nodesExpanded = 0;
    let stepNum = 0;

    pq.push(problem.startNode, h(problem.startNode));

    const snap = (): InformedSearchState => ({
      frontier: pq.toArray(),
      explored: deepClone(explored),
      pathMap: deepClone(pathMap),
      foundPath: null,
      gCosts: deepClone(gCosts),
      hCosts: deepClone(hCosts),
      fCosts: deepClone(fCosts),
    });
    const buildPanels = (currentNode: string | null = null, foundPath: string[] | null = null) =>
      buildGraphStatePanels({
        labelOf,
        currentNode,
        solutionPath: foundPath,
        collections: [
          { title: 'Frontier (Priority Queue)', items: pq.toArray(), variant: 'frontier' },
          { title: 'Explored', items: explored, variant: 'explored' },
        ],
      });

    yield {
      stepNumber: stepNum++,
      phase: 'initializing',
      description: `A* initialized. Start="${labelOf(problem.startNode)}", g=0, h=${h(problem.startNode)}, f=${h(problem.startNode)}`,
      pseudocodeLine: 0,
      state: snap(),
      highlight: { frontierNodes: new Set([problem.startNode]), exploredNodes: new Set(), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: 0, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 1, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: 0, color: 'text-[#3FB950]' }, { label: 'h(n)', value: h(problem.startNode), color: 'text-[var(--purple)]' }, { label: 'f(n)', value: h(problem.startNode), color: 'text-[var(--accent)]' }, { label: 'Memory', value: 1, color: 'text-[var(--text-2)]' }],
      logs: [createLog(`Initialized A* search at node ${labelOf(problem.startNode)} (h=${h(problem.startNode)})`, 'info')],
      statePanels: buildPanels()
    };

    while (!pq.isEmpty) {
      const current = pq.pop()!;
      if (explored.has(current)) continue;
      explored.add(current);
      nodesExpanded++;

      const g = gCosts.get(current) ?? 0;
      const hVal = h(current);
      const fVal = g + hVal;

      yield {
        stepNumber: stepNum++,
        phase: 'expanding',
        description: `Expanding "${labelOf(current)}" — g=${g}, h=${hVal}, f=${fVal}`,
        pseudocodeLine: 6,
        state: snap(),
        highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
        metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: pq.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: g, color: 'text-[#3FB950]' }, { label: 'h(n)', value: hVal, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: fVal, color: 'text-[var(--accent)]' }, { label: 'Memory', value: pq.size + explored.size, color: 'text-[var(--text-2)]' }],
        logs: [createLog(`Expanding node ${labelOf(current)} (f=${fVal} = g:${g} + h:${hVal})`, 'info')],
        statePanels: buildPanels(current)
    };

      if (current === problem.goalNode) {
        const foundPath = reconstructPath(pathMap, current);
        yield {
          stepNumber: stepNum++,
          phase: 'found',
          description: `Goal "${labelOf(problem.goalNode)}" found! Optimal cost: ${g}`,
          pseudocodeLine: 7,
          state: { ...snap(), foundPath },
          highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: current, pathEdges: foundPath },
          metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: foundPath.length - 1, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: g, color: 'text-[#3FB950]' }, { label: 'h(n)', value: 0, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: g, color: 'text-[var(--accent)]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
          logs: [createLog(`SUCCESS: Goal reached with optimal cost ${g}!`, 'success')],
          statePanels: buildPanels(current, foundPath)
        };
        return;
      }

      for (const { neighbor, weight } of adj.get(current) ?? []) {
        if (explored.has(neighbor)) continue;
        const newG = g + weight;
        const isUpdate = gCosts.has(neighbor);
        if (newG < (gCosts.get(neighbor) ?? Infinity)) {
          gCosts.set(neighbor, newG);
          const neighborH = h(neighbor);
          const neighborF = newG + neighborH; // A* uses f = g + h
          hCosts.set(neighbor, neighborH);
          fCosts.set(neighbor, neighborF);
          pathMap.set(neighbor, current);
          pq.push(neighbor, neighborF);

          yield {
            stepNumber: stepNum++,
            phase: 'visiting',
            description: `${isUpdate ? 'Updating' : 'Discovering'} "${labelOf(neighbor)}" via "${labelOf(current)}" — g=${newG}, h=${neighborH}, f=${neighborF}`,
            pseudocodeLine: 12, // Adjusted pseudocode line to match the original A* pseudocode structure
            state: snap(),
            highlight: { frontierNodes: new Set(pq.toArray()), exploredNodes: new Set(explored), currentNode: current, pathEdges: null },
            metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: pq.size, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: newG, color: 'text-[#3FB950]' }, { label: 'h(n)', value: neighborH, color: 'text-[var(--purple)]' }, { label: 'f(n)', value: neighborF, color: 'text-[var(--accent)]' }, { label: 'Memory', value: pq.size + explored.size, color: 'text-[var(--text-2)]' }],
            logs: [createLog(`${isUpdate ? 'Updated' : 'Discovered'} node ${labelOf(neighbor)} in frontier (f=${neighborF})`, 'info')],
            statePanels: buildPanels(current)
        };
        }
      }
    }

    yield {
      stepNumber: stepNum++,
      phase: 'failed',
      description: 'A* failed — no path exists.',
      pseudocodeLine: 14,
      state: snap(),
      highlight: { frontierNodes: new Set(), exploredNodes: new Set(explored), currentNode: null, pathEdges: null },
      metrics: [{ label: 'Expanded', value: nodesExpanded, color: 'text-[var(--accent)]' }, { label: 'Frontier', value: 0, color: 'text-[var(--accent)]' }, { label: 'Depth', value: 0, color: 'text-[var(--text)]' }, { label: 'Path Cost', value: Infinity, color: 'text-[#3FB950]' }, { label: 'Memory', value: explored.size, color: 'text-[var(--text-2)]' }],
      logs: [createLog('FAILURE: No path exists to the goal node', 'error')],
      statePanels: buildPanels()
    };
  },
};
