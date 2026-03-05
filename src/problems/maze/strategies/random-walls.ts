import type { MazeGenerationStrategy } from './types';

const cellId = (r: number, c: number) => `r${r}c${c}`;

function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 0x85ebca6b;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function parseCell(id: string): [number, number] {
  const m = /^r(\d+)c(\d+)$/.exec(id);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

export const randomWallsStrategy: MazeGenerationStrategy = ({
  rows,
  cols,
  seed,
  startNode,
  goalNode,
}) => {
  const random = createSeededRng(seed);
  const walls = new Set<string>();
  const terrain: Record<string, number> = {};

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cellId(r, c);
      if (id === startNode || id === goalNode) continue;

      if (random() < 0.28) {
        walls.add(id);
      }

      // 40% of open cells receive weighted terrain [2..6].
      if (!walls.has(id) && random() < 0.4) {
        terrain[id] = 2 + Math.floor(random() * 5);
      }
    }
  }

  // Guarantee a clear corridor from start to goal.
  const [sr, sc] = parseCell(startNode);
  const [gr, gc] = parseCell(goalNode);
  let cr = sr;
  let cc = sc;

  while (cr !== gr) {
    cr += cr < gr ? 1 : -1;
    walls.delete(cellId(cr, cc));
  }
  while (cc !== gc) {
    cc += cc < gc ? 1 : -1;
    walls.delete(cellId(cr, cc));
  }

  walls.delete(startNode);
  walls.delete(goalNode);

  return {
    walls: Array.from(walls),
    terrain,
  };
};
