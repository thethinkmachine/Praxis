import type { AlgorithmRunner } from '@/types/algorithm';
import type { AlgorithmStep } from '@/types/step';
import type { LocalSearchProblem } from '@/types/problem';
import type { LocalSearchCandidate, LocalSearchPopulationMember, LocalSearchStat } from '@/problems/local-search/types';

export interface LocalSearchTraceState {
  problemKind: LocalSearchProblem['kind'];
  objectiveLabel: string;
  objectiveGoal: 'minimize' | 'maximize';
  stateLabel: string;
  currentState: unknown;
  bestState: unknown;
  currentSummary: string;
  bestSummary: string;
  currentScore: number;
  bestScore: number;
  currentValue: number;
  bestValue: number;
  currentDisplayValue: string;
  bestDisplayValue: string;
  goalReached: boolean;
  candidateMoves: LocalSearchCandidate[];
  acceptedMove: LocalSearchCandidate | null;
  rejectedMove: LocalSearchCandidate | null;
  iteration: number;
  restartCount: number;
  plateauLength: number;
  stagnationSteps: number;
  sidewaysMovesUsed: number;
  sidewaysMoveLimit: number | null;
  temperature: number | null;
  beamWidth: number | null;
  generation: number | null;
  populationSize: number | null;
  tabuSize: number | null;
  notes: string[];
  currentStats: LocalSearchStat[];
  bestStats: LocalSearchStat[];
  populationPreview: LocalSearchPopulationMember[];
  tabuEntries: string[];
  domainData: Record<string, unknown>;
}

export interface LocalSearchTraceHighlight {
  acceptedCandidateId: string | null;
  rejectedCandidateId: string | null;
  focusKeys: string[];
}

export interface LocalSearchResult {
  solved: boolean;
  bestState: unknown;
  bestScore: number;
  bestValue: number;
  bestDisplayValue: string;
  iterations: number;
  restarts: number;
}

export type LocalSearchRunner = AlgorithmRunner<
  LocalSearchProblem,
  LocalSearchTraceState,
  LocalSearchTraceHighlight,
  LocalSearchResult
>;

export type LocalSearchStep = AlgorithmStep<LocalSearchTraceState, LocalSearchTraceHighlight>;
