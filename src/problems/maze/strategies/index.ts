import { recursiveBacktrackerStrategy } from './recursive-backtracker';
import { randomWallsStrategy } from './random-walls';
import type { MazeGenerationStrategy, MazeGenerationStrategyId } from './types';

export const MAZE_STRATEGIES: Record<MazeGenerationStrategyId, MazeGenerationStrategy> = {
  'recursive-backtracker': recursiveBacktrackerStrategy,
  'random-walls': randomWallsStrategy,
};

export const MAZE_STRATEGY_LABELS: Record<MazeGenerationStrategyId, string> = {
  'recursive-backtracker': 'Recursive Backtracker',
  'random-walls': 'Random Walls + Terrain',
};

export type { MazeGenerationStrategyId } from './types';
