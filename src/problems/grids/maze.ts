import type { GraphData } from '@/types/problem';

// ---------------------------------------------------------------------------
// Maze generator using randomised DFS (recursive backtracker algorithm).
// The maze is represented as a GraphData where each passage is an edge.
// Walls between cells are not represented explicitly.
// ---------------------------------------------------------------------------

export function createMaze(rows: number, cols: number): GraphData {
  const visited = new Set<string>();
  const edges: { id: string; source: string; target: string; weight: number }[] = [];

  const cellId = (r: number, c: number) => `r${r}c${c}`;

  const orthogonalNeighbors = (r: number, c: number) => {
    const ns: [number, number][] = [];
    if (r > 0)        ns.push([r - 1, c]);
    if (r < rows - 1) ns.push([r + 1, c]);
    if (c > 0)        ns.push([r, c - 1]);
    if (c < cols - 1) ns.push([r, c + 1]);
    return ns;
  };

  // Shuffle helper (Fisher-Yates)
  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Iterative DFS to avoid potential stack overflow on large grids
  const stack: [number, number][] = [[0, 0]];
  visited.add(cellId(0, 0));

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const unvisited = orthogonalNeighbors(r, c).filter(
      ([nr, nc]) => !visited.has(cellId(nr, nc)),
    );

    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }

    const [nr, nc] = shuffle(unvisited)[0];
    const fromId = cellId(r, c);
    const toId = cellId(nr, nc);
    edges.push({ id: `e-${fromId}-${toId}`, source: fromId, target: toId, weight: 1 });
    visited.add(toId);
    stack.push([nr, nc]);
  }

  const nodes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push({ id: cellId(r, c), label: cellId(r, c), x: c * 80, y: r * 80 });
    }
  }

  return { nodes, edges, directed: false };
}
