import type { AlgorithmRunner } from '@/types/algorithm';
import type { AlgorithmStep } from '@/types/step';
import type { PlanningProblem } from '@/types/problem';

export interface PlanningFrontierEntry {
  id: string;
  label: string;
  depth: number;
  heuristic: number;
  planLength: number;
}

export interface PlanningGraphLayerView {
  level: number;
  propositions: string[];
  actions: string[];
  propositionMutex: string[];
  actionMutex: string[];
}

export interface PlanningCausalLinkView {
  id: string;
  from: string;
  to: string;
  literal: string;
}

export interface PlanningFlawView {
  id: string;
  type: 'open-precondition' | 'threat';
  label: string;
  detail: string;
}

export interface PlanningPartialPlanView {
  actions: { id: string; label: string }[];
  orderings: Array<[string, string]>;
  causalLinks: PlanningCausalLinkView[];
  openFlaws: PlanningFlawView[];
}

export interface PlanningCnfSummaryEntry {
  horizon: number;
  propositionVariables: number;
  actionVariables: number;
  clauseCount: number;
  satisfiable?: boolean;
}

export interface PlanningTraceState {
  mode: 'strips' | 'state-space' | 'goal-stack' | 'planning-graph' | 'partial-order';
  domainName: string;
  presetId: PlanningProblem['presetId'];
  currentStateLiterals: string[];
  currentGoals: string[];
  satisfiedGoals: string[];
  unsatisfiedGoals: string[];
  frontier: PlanningFrontierEntry[];
  exploredKeys: string[];
  applicableActions: { id: string; label: string; detail: string }[];
  selectedActionId: string | null;
  selectedActionLabel: string | null;
  planSoFar: string[];
  groundedActionLabels: string[];
  goalStack: string[];
  graphLayers: PlanningGraphLayerView[];
  extractedPlan: string[][];
  cnfSummary: PlanningCnfSummaryEntry[];
  partialPlan: PlanningPartialPlanView | null;
  notes: string[];
}

export interface PlanningTraceHighlight {
  currentLiterals: string[];
  currentGoals: string[];
  selectedActionId: string | null;
  frontierIds: string[];
  focusLayer: number | null;
  focusFlawId: string | null;
}

export interface PlanningResult {
  solved: boolean;
  plan: string[];
  parallelPlan?: string[][];
  visited: number;
  finalState: string[];
  horizon?: number;
  notes: string[];
}

export type PlanningRunner = AlgorithmRunner<
  PlanningProblem,
  PlanningTraceState,
  PlanningTraceHighlight,
  PlanningResult
>;

export type PlanningStep = AlgorithmStep<PlanningTraceState, PlanningTraceHighlight>;
