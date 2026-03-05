import type { GraphData, GraphProblem } from '@/types/problem';

// 8-node graph that clearly demonstrates BFS vs DFS path differences.
// BFS finds shortest hop path S->B->G, DFS may explore S->A->C->D->E->F->G first.
//
//      S(0)---A(1)---C(3)---D(4)
//      |      |             |
//      B(2)   E(5)          F(6)
//       \                  /
//        --------G(7)------
//
export const simpleGraphData: GraphData = {
  directed: false,
  nodes: [
    { id: 'S', label: 'S', x: 80,  y: 80,  heuristic: 4 },
    { id: 'A', label: 'A', x: 240, y: 80,  heuristic: 3 },
    { id: 'B', label: 'B', x: 80,  y: 220, heuristic: 3 },
    { id: 'C', label: 'C', x: 400, y: 80,  heuristic: 2 },
    { id: 'D', label: 'D', x: 560, y: 80,  heuristic: 2 },
    { id: 'E', label: 'E', x: 240, y: 220, heuristic: 2 },
    { id: 'F', label: 'F', x: 560, y: 220, heuristic: 1 },
    { id: 'G', label: 'G', x: 320, y: 340, heuristic: 0 },
  ],
  edges: [
    { id: 'e-S-A', source: 'S', target: 'A', weight: 1 },
    { id: 'e-S-B', source: 'S', target: 'B', weight: 1 },
    { id: 'e-A-C', source: 'A', target: 'C', weight: 1 },
    { id: 'e-A-E', source: 'A', target: 'E', weight: 2 },
    { id: 'e-C-D', source: 'C', target: 'D', weight: 1 },
    { id: 'e-D-F', source: 'D', target: 'F', weight: 1 },
    { id: 'e-B-G', source: 'B', target: 'G', weight: 2 },
    { id: 'e-E-G', source: 'E', target: 'G', weight: 2 },
    { id: 'e-F-G', source: 'F', target: 'G', weight: 2 },
  ],
};

export const simpleGraphProblem: GraphProblem = {
  graph: simpleGraphData,
  startNode: 'S',
  goalNode: 'G',
  useHeuristic: false,
};
