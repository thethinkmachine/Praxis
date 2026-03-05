import type { GraphNode, GraphEdge, GraphProblem } from '@/types/problem';

/**
 * 5×4 weighted grid (5 columns, 4 rows = 20 nodes) with varied edge weights
 * to showcase weighted uninformed search.
 *
 * Node IDs:    r{row}c{col}  (r0c0 = top-left, r3c4 = bottom-right)
 * Node labels: "row,col"
 * Positions:   x = col * 120, y = row * 120
 * Heuristic:   Manhattan distance to goal r3c4 × 5
 */

const ROWS = 4;
const COLS = 5;
const GOAL_ROW = 3;
const GOAL_COL = 4;

const H_WEIGHTS = [7, 12, 5, 9, 8, 14, 6, 11, 15, 4, 10, 13];
const V_WEIGHTS = [9, 6, 13, 11, 8, 5, 14, 7, 10, 12, 4, 15, 6, 9, 11];

const nodes: GraphNode[] = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    nodes.push({
      id: `r${r}c${c}`,
      label: `${r},${c}`,
      x: c * 120,
      y: r * 120,
      heuristic: (Math.abs(GOAL_ROW - r) + Math.abs(GOAL_COL - c)) * 5,
    });
  }
}

const edges: GraphEdge[] = [];
let hIdx = 0;
let vIdx = 0;

// Horizontal edges: iterate row-major so ordering matches the weight table
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c + 1 < COLS; c++) {
    const src = `r${r}c${c}`;
    const tgt = `r${r}c${c + 1}`;
    edges.push({
      id: `e-${src}-${tgt}`,
      source: src,
      target: tgt,
      weight: H_WEIGHTS[hIdx % H_WEIGHTS.length],
    });
    hIdx++;
  }
}

// Vertical edges: iterate col-major so ordering matches the weight table
for (let c = 0; c < COLS; c++) {
  for (let r = 0; r + 1 < ROWS; r++) {
    const src = `r${r}c${c}`;
    const tgt = `r${r + 1}c${c}`;
    edges.push({
      id: `e-${src}-${tgt}`,
      source: src,
      target: tgt,
      weight: V_WEIGHTS[vIdx % V_WEIGHTS.length],
    });
    vIdx++;
  }
}

export const weightedGridData: { nodes: GraphNode[]; edges: GraphEdge[] } = {
  nodes,
  edges,
};

export const weightedGridProblem: GraphProblem = {
  graph: {
    directed: false,
    nodes: weightedGridData.nodes,
    edges: weightedGridData.edges,
  },
  startNode: 'r0c0',
  goalNode: 'r3c4',
  useHeuristic: true,
};
