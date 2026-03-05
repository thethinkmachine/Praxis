export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'success' | 'error';
  message: string;
  stepIndex?: number;
}

export interface StepMetrics {
  nodesExpanded: number;
  frontierSize: number;
  maxFrontierSize?: number; // Total max encountered in run
  currentDepth: number;
  pathCost: number;
  heuristicValue?: number;
  heuristicError?: number;
  memoryUsed: number;
  elapsedMs?: number;
  gCost?: number;
  hCost?: number;
  fCost?: number;
}

export type StepPhase =
  | 'initializing'
  | 'expanding'
  | 'visiting'
  | 'backtracking'
  | 'pruning'
  | 'found'
  | 'failed';

export interface AlgorithmStep<TState = unknown, THighlight = unknown> {
  stepNumber: number;
  phase: StepPhase;
  description: string;
  state: TState;
  highlight: THighlight;
  pseudocodeLine: number;
  metrics: StepMetrics;
  logs?: LogEntry[];
}
