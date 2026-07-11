export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'success' | 'error';
  message: string;
  stepIndex?: number;
}

export interface MetricTile {
  label: string;
  value: number | string;
  color?: string;
  fullWidth?: boolean;
}

export type PanelChipVariant = 'frontier' | 'current' | 'explored' | 'path' | 'pruned' | 'strategy';

export interface PanelKeyValueItem {
  key: string;
  value: string | number;
}

export interface PanelChipItem {
  id: string;
  label: string;
  detail?: string;
  variant?: PanelChipVariant;
}

export interface PanelNodeItem {
  id: string;
  label: string;
  detail?: string;
}

export type PanelSection =
  | { type: 'key-value'; title: string; count?: number; items: PanelKeyValueItem[] }
  | { type: 'chips'; title: string; count?: number; items: PanelChipItem[] }
  | { type: 'nodes'; title: string; count?: number; items: PanelNodeItem[] };

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
  currentScore?: number;
  bestScore?: number;
  candidateCount?: number;
  neighborsEvaluated?: number;
  restartCount?: number;
  plateauLength?: number;
  temperature?: number;
  conflictCount?: number;
  bestConflictCount?: number;
  iteration?: number;
  stagnationSteps?: number;
  generation?: number;
  populationSize?: number;
  beamWidth?: number;
  tabuSize?: number;
  objectiveValue?: number;
  bestObjectiveValue?: number;
}

export type StepPhase =
  | 'initializing'
  | 'expanding'
  | 'visiting'
  | 'propagating'
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
  metrics: StepMetrics | MetricTile[];
  statePanels?: PanelSection[];
  logs?: LogEntry[];
}
