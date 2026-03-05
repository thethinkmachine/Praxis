import type { MazeGenerationStrategy } from './types';

const cellId = (r: number, c: number) => `r${r}c${c}`;

function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function shuffleInPlace<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Perfect-maze style generator on a full cell grid.
 * Works best on odd dimensions but still produces usable mazes for even sizes.
 */
export const recursiveBacktrackerStrategy: MazeGenerationStrategy = ({
  rows,
  cols,
  seed,
  startNode,
  goalNode,
}) => {
  const random = createSeededRng(seed);
  const passages = new Set<string>();
  const visited = new Set<string>();

  const startR = 0;
  const startC = 0;

  const stack: Array<[number, number]> = [[startR, startC]];
  visited.add(cellId(startR, startC));
  passages.add(cellId(startR, startC));

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];

    const candidates = [
      [r - 2, c],
      [r + 2, c],
      [r, c - 2],
      [r, c + 2],
    ]
      .filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(cellId(nr, nc))) as Array<[number, number]>;

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const [nr, nc] = shuffleInPlace(candidates, random)[0];
    const wr = Math.floor((r + nr) / 2);
    const wc = Math.floor((c + nc) / 2);

    visited.add(cellId(nr, nc));
    passages.add(cellId(nr, nc));
    passages.add(cellId(wr, wc));
    stack.push([nr, nc]);
  }

  const walls: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cellId(r, c);
      if (!passages.has(id)) walls.push(id);
    }
  }

  // Always keep start and goal clear.
  const filteredWalls = walls.filter(id => id !== startNode && id !== goalNode);

  return {
    walls: filteredWalls,
    terrain: {},
  };
};
