export interface MazeGenerationContext {
  rows: number;
  cols: number;
  seed: number;
  startNode: string;
  goalNode: string;
}

export interface MazeGenerationResult {
  walls: string[];
  terrain: Record<string, number>;
}

export type MazeGenerationStrategyId = 'recursive-backtracker' | 'random-walls';

export type MazeGenerationStrategy = (ctx: MazeGenerationContext) => MazeGenerationResult;
