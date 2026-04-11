import type { AlgorithmRunner } from '@/types/algorithm';
import type { AlgorithmStep } from '@/types/step';
import type { CspProblem, CspValue } from '@/types/problem';

export interface CspPrunedValue {
  variable: string;
  value: CspValue;
  reason: string;
}

export interface CspValueChoice {
  value: CspValue;
  score?: number;
}

export interface CspTraceState {
  title: string;
  assignment: Record<string, CspValue>;
  domains: Record<string, CspValue[]>;
  currentVariable: string | null;
  currentValue: CspValue | null;
  orderedValues: CspValueChoice[];
  arcQueue: string[];
  selectedConstraintId: string | null;
  prunedValues: CspPrunedValue[];
  violatedConstraints: string[];
  recursionStack: string[];
  notes: string[];
}

export interface CspTraceHighlight {
  currentVariable: string | null;
  focusVariables: string[];
  prunedKeys: string[];
}

export interface CspResult {
  solved: boolean;
  assignment: Record<string, CspValue>;
  visited: number;
  notes: string[];
}

export type CspRunner = AlgorithmRunner<CspProblem, CspTraceState, CspTraceHighlight, CspResult>;
export type CspStep = AlgorithmStep<CspTraceState, CspTraceHighlight>;
