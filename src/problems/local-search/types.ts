import type { LocalSearchProblem } from '@/types/problem';

export interface LocalSearchStat {
  label: string;
  value: string | number;
}

export interface LocalSearchEvaluation {
  score: number;
  value: number;
  displayValue: string;
  goalReached: boolean;
  summary: string;
  stats?: LocalSearchStat[];
}

export interface LocalSearchCandidate {
  id: string;
  label: string;
  description: string;
  state: unknown;
  score: number;
  value: number;
  displayValue: string;
  delta: number;
  moveKey?: string;
  preview?: string;
  details?: string[];
  meta?: Record<string, number | string | boolean | null>;
}

export interface LocalSearchPopulationMember {
  id: string;
  summary: string;
  displayValue: string;
  score: number;
  state: unknown;
}

export interface LocalSearchDomain<TProblem extends LocalSearchProblem = LocalSearchProblem, TState = unknown> {
  kind: TProblem['kind'];
  label: string;
  objectiveLabel: string;
  objectiveGoal: 'minimize' | 'maximize';
  stateLabel: string;
  validate: (problem: TProblem) => { valid: boolean; errors: string[]; warnings?: string[] };
  createRandomState: (problem: TProblem, random: () => number) => TState;
  normalizeState: (problem: TProblem, random: () => number) => TState;
  evaluate: (problem: TProblem, state: TState) => LocalSearchEvaluation;
  getNeighbors: (problem: TProblem, state: TState, random: () => number) => LocalSearchCandidate[];
  getRandomNeighbor?: (problem: TProblem, state: TState, random: () => number) => LocalSearchCandidate | null;
  getRepairCandidates?: (problem: TProblem, state: TState, random: () => number) => LocalSearchCandidate[];
  crossover?: (problem: TProblem, left: TState, right: TState, random: () => number) => TState;
  mutate?: (problem: TProblem, state: TState, random: () => number) => TState;
  serializeState: (problem: TProblem, state: TState) => string;
  describeState: (problem: TProblem, state: TState) => string;
  getStateStats?: (problem: TProblem, state: TState) => LocalSearchStat[];
  getDomainData?: (problem: TProblem, state: TState) => Record<string, unknown>;
  getPopulationMemberSummary?: (problem: TProblem, state: TState) => LocalSearchPopulationMember;
}
