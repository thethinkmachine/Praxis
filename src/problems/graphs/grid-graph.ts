import type { GraphNode, GraphEdge } from '@/types/problem';

/**
 * Creates a grid graph where each cell connects to its orthogonal neighbors.
 * Node IDs: r{row}c{col} (e.g. r0c0, r0c1).
 * Positions: x = col * 80, y = row * 80.
 * All edge weights = 1.
 *
 * Optional goalRow / goalCol set a Manhattan-distance heuristic on each node.
 * Defaults to the bottom-right corner (rows-1, cols-1).
 */
export function createGridGraph(
  rows: number,
  cols: number,
  goalRow?: number,
  goalCol?: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const gRow = goalRow ?? rows - 1;
  const gCol = goalCol ?? cols - 1;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `r${r}c${c}`;
      nodes.push({
        id,
        label: id,
        x: c * 80,
        y: r * 80,
        heuristic: Math.abs(gRow - r) + Math.abs(gCol - c),
      });

      // Right neighbor
      if (c + 1 < cols) {
        const rightId = `r${r}c${c + 1}`;
        edges.push({ id: `e-${id}-${rightId}`, source: id, target: rightId, weight: 1 });
      }
      // Down neighbor
      if (r + 1 < rows) {
        const downId = `r${r + 1}c${c}`;
        edges.push({ id: `e-${id}-${downId}`, source: id, target: downId, weight: 1 });
      }
    }
  }

  return { nodes, edges };
}
