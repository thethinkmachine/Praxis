import { createLog, statePanels as panelSections } from '@/algorithms/core/utils';
import type { PanelSection } from '@/types';
import type { LocalSearchProblem } from '@/types/problem';
import type { LocalSearchStep, LocalSearchTraceHighlight, LocalSearchTraceState, LocalSearchResult } from './types';
import type { LocalSearchCandidate, LocalSearchDomain, LocalSearchPopulationMember, LocalSearchStat } from '@/problems/local-search/types';
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
  constructionDepth?: number | null;
  pheromoneDecay?: number | null;
  pheromoneInfluence?: number | null;
  heuristicInfluence?: number | null;
  eliteWeight?: number | null;
  tabuSize?: number | null;
  populationPreview?: LocalSearchPopulationMember[];
  pheromoneStats?: LocalSearchStat[];
  tabuEntries?: string[];
  notes?: string[];
}

function isAntColonyTrace(state: Pick<LocalSearchTraceState, 'constructionDepth' | 'pheromoneDecay' | 'pheromoneInfluence' | 'heuristicInfluence' | 'eliteWeight' | 'pheromoneStats'>): boolean {
  return state.constructionDepth !== null
    || state.pheromoneDecay !== null
    || state.pheromoneInfluence !== null
    || state.heuristicInfluence !== null
    || state.eliteWeight !== null
    || state.pheromoneStats.length > 0;
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
    constructionDepth: snapshot.constructionDepth ?? null,
    pheromoneDecay: snapshot.pheromoneDecay ?? null,
    pheromoneInfluence: snapshot.pheromoneInfluence ?? null,
    heuristicInfluence: snapshot.heuristicInfluence ?? null,
    eliteWeight: snapshot.eliteWeight ?? null,
    tabuSize: snapshot.tabuSize ?? null,
    notes: [...(snapshot.notes ?? [])],
    currentStats,
    bestStats,
    populationPreview: (snapshot.populationPreview ?? []).map(item => ({ ...item })),
    pheromoneStats: [...(snapshot.pheromoneStats ?? [])],
    tabuEntries: [...(snapshot.tabuEntries ?? [])],
    domainData: {
      ...(domain.getDomainData?.(snapshot.problem, snapshot.currentState) ?? {}),
    },
  };
}

function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '-∞' : String(value);
  return `${value >= 0 ? '+' : ''}${value}`;
}

function buildStatsItems(stats: LocalSearchStat[]) {
  return stats.map(stat => ({ key: stat.label, value: stat.value }));
}

function buildCandidateDetail(candidate: LocalSearchCandidate, objectiveLabel: string): string {
  const details = [
    `${objectiveLabel}=${candidate.displayValue}`,
    `Δ=${formatSignedNumber(candidate.delta)}`,
  ];
  if (candidate.preview) details.push(candidate.preview);
  if (candidate.details?.length) details.push(...candidate.details);
  return details.join(' • ');
}

function buildStatePanels(state: LocalSearchTraceState): PanelSection[] {
  const panels: PanelSection[] = [];

  panels.push(panelSections.keyValue('Current State', [
    { key: 'State', value: state.currentSummary },
    { key: state.objectiveLabel, value: state.currentDisplayValue },
    { key: 'Score', value: state.currentScore },
    { key: 'Goal reached', value: state.goalReached ? 'yes' : 'no' },
    ...buildStatsItems(state.currentStats),
  ]));

  panels.push(panelSections.keyValue('Best So Far', [
    { key: 'State', value: state.bestSummary },
    { key: state.objectiveLabel, value: state.bestDisplayValue },
    { key: 'Score', value: state.bestScore },
    { key: 'Goal reached', value: state.goalReached ? 'yes' : 'no' },
    { key: 'Restarts', value: state.restartCount },
    ...buildStatsItems(state.bestStats),
  ]));

  const decisionItems = [
    state.acceptedMove ? { key: 'Accepted', value: buildCandidateDetail(state.acceptedMove, state.objectiveLabel) } : null,
    state.rejectedMove ? { key: 'Rejected', value: buildCandidateDetail(state.rejectedMove, state.objectiveLabel) } : null,
  ].filter((item): item is { key: string; value: string } => item !== null);
  if (decisionItems.length > 0) {
    panels.push(panelSections.keyValue('Decision', decisionItems));
  }

  if (state.candidateMoves.length > 0) {
    panels.push(panelSections.nodes(
      'Candidate Moves',
      state.candidateMoves.map(candidate => ({
        id: candidate.id,
        label: candidate.label,
        detail: buildCandidateDetail(candidate, state.objectiveLabel),
      })),
    ));
  }

  if (state.populationPreview.length > 0) {
    panels.push(panelSections.nodes(
      isAntColonyTrace(state) ? 'Ant Colony Preview' : 'Population Preview',
      state.populationPreview.map(member => ({
        id: member.id,
        label: member.summary,
        detail: member.displayValue,
      })),
    ));
  }

  const runStateItems = [
    { key: 'Iteration', value: state.iteration },
    { key: 'Restarts', value: state.restartCount },
    { key: 'Plateau length', value: state.plateauLength },
    { key: 'Stagnation', value: state.stagnationSteps },
    { key: 'Sideways', value: state.sidewaysMoveLimit == null ? state.sidewaysMovesUsed : `${state.sidewaysMovesUsed} / ${state.sidewaysMoveLimit}` },
  ];
  if (state.generation !== null) runStateItems.push({ key: 'Generation', value: state.generation });
  if (state.beamWidth !== null) runStateItems.push({ key: 'Beam width', value: state.beamWidth });
  if (state.populationSize !== null) runStateItems.push({ key: isAntColonyTrace(state) ? 'Colony size' : 'Population size', value: state.populationSize });
  if (state.constructionDepth !== null) runStateItems.push({ key: 'Construction depth', value: state.constructionDepth });
  if (state.pheromoneDecay !== null) runStateItems.push({ key: 'Pheromone decay', value: `${(state.pheromoneDecay * 100).toFixed(0)}%` });
  if (state.pheromoneInfluence !== null) runStateItems.push({ key: 'Alpha', value: state.pheromoneInfluence });
  if (state.heuristicInfluence !== null) runStateItems.push({ key: 'Beta', value: state.heuristicInfluence });
  if (state.eliteWeight !== null) runStateItems.push({ key: 'Elite weight', value: state.eliteWeight });
  if (state.tabuSize !== null) runStateItems.push({ key: 'Tabu size', value: state.tabuSize });
  if (state.temperature !== null) runStateItems.push({ key: 'Temperature', value: Number.isFinite(state.temperature) ? state.temperature.toFixed(3) : String(state.temperature) });
  panels.push(panelSections.keyValue('Run State', runStateItems));

  if (state.pheromoneStats.length > 0) {
    panels.push(panelSections.keyValue('Pheromone Trails', buildStatsItems(state.pheromoneStats)));
  }

  if (state.tabuEntries.length > 0) {
    panels.push(panelSections.chips(
      'Tabu List',
      state.tabuEntries.map((entry, index) => ({
        id: `${index}`,
        label: entry,
        variant: 'explored',
      })),
    ));
  }

  if (state.notes.length > 0) {
    panels.push(panelSections.keyValue('Notes', state.notes.map((note, index) => ({ key: `Note ${index + 1}`, value: note }))));
  }

  return panels;
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
    statePanels: buildStatePanels(state),
    metrics: [
      { label: 'Evaluated', value: ctx.neighborsEvaluated, color: 'text-[var(--text)]' },
      { label: 'Candidates', value: state.candidateMoves.length, color: 'text-[var(--accent)]' },
      { label: 'Iteration', value: snapshot.iteration, color: 'text-[var(--accent)]' },
      { label: 'Objective', value: state.currentValue, color: 'text-[var(--warning)]' },
      { label: 'Best', value: state.bestValue, color: 'text-[var(--success)]' },
      { label: 'Restarts', value: state.restartCount, color: 'text-[var(--text)]' },
      { label: 'Plateau', value: state.plateauLength, color: 'text-[var(--text-2)]' },
      ...(state.constructionDepth !== null ? [{ label: 'Depth', value: state.constructionDepth!, color: 'text-[var(--text)]' }] : []),
      ...(state.pheromoneDecay !== null ? [{ label: 'Decay', value: state.pheromoneDecay!, color: 'text-[var(--purple)]' }] : []),
      ...(state.pheromoneInfluence !== null ? [{ label: 'Alpha', value: state.pheromoneInfluence!, color: 'text-[var(--text-2)]' }] : []),
      ...(state.heuristicInfluence !== null ? [{ label: 'Beta', value: state.heuristicInfluence!, color: 'text-[var(--warning)]' }] : []),
      ...(state.eliteWeight !== null ? [{ label: 'Elite', value: state.eliteWeight!, color: 'text-[var(--accent)]' }] : []),
      ...(state.temperature !== null ? [{ label: 'Temp', value: state.temperature!, color: 'text-[var(--purple)]' }] : []),
      ...(state.generation !== null ? [{ label: 'Generation', value: state.generation!, color: 'text-[var(--text)]' }] : []),
      ...(state.populationSize !== null ? [{ label: isAntColonyTrace(state) ? 'Colony' : 'Population', value: state.populationSize!, color: 'text-[var(--text)]' }] : []),
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
