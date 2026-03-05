import type { MazeProblem } from '@/types/problem';
import { applyMazeStrategy, createDefaultMazeProblem } from './maze';
import type { MazeGenerationStrategyId } from './strategies';

export interface MazeDemo {
  id: string;
  name: string;
  rows: number;
  cols: number;
  seed: number;
  strategy: MazeGenerationStrategyId;
}

export const MAZE_DEMOS: MazeDemo[] = [
  {
    id: 'labyrinth',
    name: 'Labyrinth',
    rows: 16,
    cols: 24,
    seed: 4242,
    strategy: 'recursive-backtracker',
  },
  {
    id: 'weighted-terrain',
    name: 'Weighted Terrain',
    rows: 14,
    cols: 20,
    seed: 1337,
    strategy: 'random-walls',
  },
  {
    id: 'compact-training',
    name: 'Compact Training',
    rows: 10,
    cols: 14,
    seed: 909,
    strategy: 'recursive-backtracker',
  },
];

export function buildMazeDemo(demo: MazeDemo): MazeProblem {
  const base = createDefaultMazeProblem(demo.rows, demo.cols, demo.seed);
  return applyMazeStrategy({ ...base, strategy: demo.strategy }, demo.strategy, demo.seed);
}
