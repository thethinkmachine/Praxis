import { createLog } from '@/algorithms/core/utils';
import type { LocalSearchProblem } from '@/types/problem';
import type { LocalSearchStep, LocalSearchTraceHighlight, LocalSearchTraceState, LocalSearchResult } from './types';
import type { LocalSearchCandidate, LocalSearchDomain, LocalSearchPopulationMember } from '@/problems/local-search/types';
import { createSeededRandom } from '@/problems/local-search/n-queens';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export interface LocalSearchContext {
  domain: LocalSearchDomain;
  random: () => number;
  stepNumber: number;
  iterations: number;
  neighborsEvaluated: number;
  bestScore: number;
  restarts: number;
}

export interface Snapshot {
  problem: LocalSearchProblem;
  currentState: unknown;
  bestState: unknown;
  candidateMoves?: LocalSearchCandidate[];
  acceptedMove?: LocalSearchCandidate | null;
  rejectedMove?: LocalSearchCandidate | null;
  iteration: number;
  restartCount: number;
  plateauLength: number;
  stagnationSteps: number;
  sidewaysMovesUsed?: number;
  sidewaysMoveLimit?: number | null;
  temperature?: number | null;
  beamWidth?: number | null;
  generation?: number | null;
  populationSize?: number | null;
  tabuSize?: number | null;
  populationPreview?: LocalSearchPopulationMember[];
  tabuEntries?: string[];
  notes?: string[];
}

export function createContext(problem: LocalSearchProblem): LocalSearchContext {
  const domain = getLocalSearchDomain(problem);
  const random = createSeededRandom(problem.randomSeed ?? 1337);
  const initial = domain.normalizeState(problem, random);
  return {
    domain,
    random,
    stepNumber: 0,
    iterations: 0,
    neighborsEvaluated: 0,
    bestScore: domain.evaluate(problem, initial).score,
    restarts: 0,
  };
}

function buildHighlight(snapshot: Snapshot): LocalSearchTraceHighlight {
  return {
    acceptedCandidateId: snapshot.acceptedMove?.id ?? null,
    rejectedCandidateId: snapshot.rejectedMove?.id ?? null,
    focusKeys: [
      snapshot.acceptedMove?.moveKey,
      snapshot.rejectedMove?.moveKey,
    ].filter((value): value is string => typeof value === 'string'),
  };
}

function buildState(ctx: LocalSearchContext, snapshot: Snapshot): LocalSearchTraceState {
  const { domain } = ctx;
  const currentEval = domain.evaluate(snapshot.problem, snapshot.currentState);
  const bestEval = domain.evaluate(snapshot.problem, snapshot.bestState);
  const currentStats = domain.getStateStats?.(snapshot.problem, snapshot.currentState) ?? currentEval.stats ?? [];
  const bestStats = domain.getStateStats?.(snapshot.problem, snapshot.bestState) ?? bestEval.stats ?? [];
  return {
    problemKind: snapshot.problem.kind,
    objectiveLabel: domain.objectiveLabel,
    objectiveGoal: domain.objectiveGoal,
    stateLabel: domain.stateLabel,
    currentState: snapshot.currentState,
    bestState: snapshot.bestState,
    currentSummary: domain.describeState(snapshot.problem, snapshot.currentState),
    bestSummary: domain.describeState(snapshot.problem, snapshot.bestState),
    currentScore: currentEval.score,
    bestScore: bestEval.score,
    currentValue: currentEval.value,
    bestValue: bestEval.value,
    currentDisplayValue: currentEval.displayValue,
    bestDisplayValue: bestEval.displayValue,
    goalReached: currentEval.goalReached || bestEval.goalReached,
    candidateMoves: (snapshot.candidateMoves ?? []).map(candidate => ({ ...candidate })),
    acceptedMove: snapshot.acceptedMove ? { ...snapshot.acceptedMove } : null,
    rejectedMove: snapshot.rejectedMove ? { ...snapshot.rejectedMove } : null,
    iteration: snapshot.iteration,
    restartCount: snapshot.restartCount,
    plateauLength: snapshot.plateauLength,
    stagnationSteps: snapshot.stagnationSteps,
    sidewaysMovesUsed: snapshot.sidewaysMovesUsed ?? 0,
    sidewaysMoveLimit: snapshot.sidewaysMoveLimit ?? null,
    temperature: snapshot.temperature ?? null,
    beamWidth: snapshot.beamWidth ?? null,
    generation: snapshot.generation ?? null,
    populationSize: snapshot.populationSize ?? null,
    tabuSize: snapshot.tabuSize ?? null,
    notes: [...(snapshot.notes ?? [])],
    currentStats,
    bestStats,
    populationPreview: (snapshot.populationPreview ?? []).map(item => ({ ...item })),
    tabuEntries: [...(snapshot.tabuEntries ?? [])],
    domainData: {
      ...(domain.getDomainData?.(snapshot.problem, snapshot.currentState) ?? {}),
    },
  };
}

export function getInitialState(problem: LocalSearchProblem): LocalSearchTraceState {
  const ctx = createContext(problem);
  const initial = ctx.domain.normalizeState(problem, ctx.random);
  return buildState(ctx, {
    problem,
    currentState: initial,
    bestState: initial,
    iteration: 0,
    restartCount: 0,
    plateauLength: 0,
    stagnationSteps: 0,
    notes: ['Ready to explore neighboring states.'],
  });
}

export function createStep(
  ctx: LocalSearchContext,
  phase: LocalSearchStep['phase'],
  description: string,
  pseudocodeLine: number,
  snapshot: Snapshot,
  level: 'info' | 'warn' | 'success' | 'error' = 'info',
): LocalSearchStep {
  const state = buildState(ctx, snapshot);
  ctx.bestScore = Math.max(ctx.bestScore, state.bestScore);
  ctx.iterations = Math.max(ctx.iterations, snapshot.iteration);
  ctx.restarts = Math.max(ctx.restarts, snapshot.restartCount);

  return {
    stepNumber: ctx.stepNumber++,
    phase,
    description,
    state,
    highlight: buildHighlight(snapshot),
    pseudocodeLine,
    metrics: [
      { label: 'Evaluated', value: ctx.neighborsEvaluated, color: 'text-[var(--text)]' },
      { label: 'Candidates', value: state.candidateMoves.length, color: 'text-[var(--accent)]' },
      { label: 'Iteration', value: snapshot.iteration, color: 'text-[var(--accent)]' },
      { label: 'Objective', value: state.currentValue, color: 'text-[var(--warning)]' },
      { label: 'Best', value: state.bestValue, color: 'text-[var(--success)]' },
      { label: 'Restarts', value: state.restartCount, color: 'text-[var(--text)]' },
      { label: 'Plateau', value: state.plateauLength, color: 'text-[var(--text-2)]' },
      ...(state.temperature !== null ? [{ label: 'Temp', value: state.temperature!, color: 'text-[var(--purple)]' }] : []),
      ...(state.generation !== null ? [{ label: 'Generation', value: state.generation!, color: 'text-[var(--text)]' }] : []),
      ...(state.populationSize !== null ? [{ label: 'Population', value: state.populationSize!, color: 'text-[var(--text)]' }] : []),
      ...(state.beamWidth !== null ? [{ label: 'Beam', value: state.beamWidth!, color: 'text-[var(--text-2)]' }] : []),
      ...(state.tabuSize !== null ? [{ label: 'Tabu', value: state.tabuSize!, color: 'text-[var(--text-2)]' }] : []),
    ],
    logs: [createLog(description, level)],
  };
}

export function buildResult(ctx: LocalSearchContext, problem: LocalSearchProblem, bestState: unknown): LocalSearchResult {
  const evaluation = ctx.domain.evaluate(problem, bestState);
  return {
    solved: evaluation.goalReached,
    bestState,
    bestScore: evaluation.score,
    bestValue: evaluation.value,
    bestDisplayValue: evaluation.displayValue,
    iterations: ctx.iterations,
    restarts: ctx.restarts,
  };
}

export function sortCandidates(candidates: LocalSearchCandidate[]): LocalSearchCandidate[] {
  return [...candidates].sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
}

export function sampleCandidates(problem: LocalSearchProblem, candidates: LocalSearchCandidate[]): LocalSearchCandidate[] {
  const sampleSize = problem.candidateSampleSize ?? 8;
  return candidates.slice(0, sampleSize);
}

export function describeEvaluation(prefix: string, ctx: LocalSearchContext, problem: LocalSearchProblem, state: unknown): string {
  const evaluation = ctx.domain.evaluate(problem, state);
  return `${prefix} ${ctx.domain.describeState(problem, state)} with ${ctx.domain.objectiveLabel.toLowerCase()} ${evaluation.displayValue}.`;
}

export function bestOf(problem: LocalSearchProblem, ctx: LocalSearchContext, states: unknown[]): unknown {
  return [...states].sort((left, right) => ctx.domain.evaluate(problem, right).score - ctx.domain.evaluate(problem, left).score)[0];
}

export function populationPreview(problem: LocalSearchProblem, ctx: LocalSearchContext, states: unknown[]): LocalSearchPopulationMember[] {
  return states
    .map(state => ctx.domain.getPopulationMemberSummary?.(problem, state) ?? {
      id: ctx.domain.serializeState(problem, state),
      summary: ctx.domain.describeState(problem, state),
      displayValue: ctx.domain.evaluate(problem, state).displayValue,
      score: ctx.domain.evaluate(problem, state).score,
      state,
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}
