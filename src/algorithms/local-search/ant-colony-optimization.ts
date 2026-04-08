import {
  DEFAULT_CONSTRUCTION_DEPTH,
  DEFAULT_ELITE_WEIGHT,
  DEFAULT_HEURISTIC_INFLUENCE,
  DEFAULT_MAX_STEPS,
  DEFAULT_PHEROMONE_DECAY,
  DEFAULT_PHEROMONE_INFLUENCE,
  DEFAULT_POPULATION,
  better,
} from './core';
import {
  buildResult,
  createContext,
  createStep,
  getInitialState,
  populationPreview,
  sampleCandidates,
  sortCandidates,
} from './shared';
import type { LocalSearchCandidate, LocalSearchStat } from '@/problems/local-search/types';
import type { LocalSearchProblem } from '@/types/problem';
import type { LocalSearchRunner } from './types';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

const PHEROMONE_BASE = 1;
const EPSILON = 1e-9;

interface AntWalkResult {
  currentState: unknown;
  bestState: unknown;
  bestScore: number;
  bestValue: number;
  bestDisplayValue: string;
  bestGoalReached: boolean;
  candidateMoves: LocalSearchCandidate[];
  acceptedMove: LocalSearchCandidate | null;
  rejectedMove: LocalSearchCandidate | null;
  trail: string[];
}

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number.isFinite(value ?? NaN) ? Math.trunc(Number(value)) : fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function clampNumber(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number.isFinite(value ?? NaN) ? Number(value) : fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function moveKey(candidate: LocalSearchCandidate): string {
  return candidate.moveKey ?? candidate.id;
}

function selectAntCandidate(
  candidates: LocalSearchCandidate[],
  pheromones: Map<string, number>,
  random: () => number,
  pheromoneInfluence: number,
  heuristicInfluence: number,
): LocalSearchCandidate | null {
  if (candidates.length === 0) return null;

  const minScore = Math.min(...candidates.map(candidate => candidate.score));
  const weights = candidates.map(candidate => {
    const key = moveKey(candidate);
    const pheromone = Math.max(pheromones.get(key) ?? PHEROMONE_BASE, EPSILON);
    const heuristic = Math.max(candidate.score - minScore + 1, EPSILON);
    return Math.pow(pheromone, pheromoneInfluence) * Math.pow(heuristic, heuristicInfluence);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return candidates[0] ?? null;
  }

  let cursor = random() * total;
  for (let index = 0; index < candidates.length; index++) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }

  return candidates[candidates.length - 1] ?? null;
}

function evaporatePheromones(pheromones: Map<string, number>, decay: number): void {
  const retention = 1 - decay;
  for (const [key, value] of [...pheromones.entries()]) {
    const next = PHEROMONE_BASE + (value - PHEROMONE_BASE) * retention;
    if (next <= PHEROMONE_BASE + EPSILON) {
      pheromones.delete(key);
    } else {
      pheromones.set(key, next);
    }
  }
}

function depositTrail(pheromones: Map<string, number>, trail: string[], amount: number): void {
  if (trail.length === 0 || amount <= 0) return;

  const perMove = amount / trail.length;
  for (const key of trail) {
    pheromones.set(key, (pheromones.get(key) ?? PHEROMONE_BASE) + perMove);
  }
}

function buildPheromoneStats(pheromones: Map<string, number>, moveLabels: Map<string, string>, limit = 8): LocalSearchStat[] {
  return [...pheromones.entries()]
    .filter(([, value]) => value > PHEROMONE_BASE + EPSILON)
    .sort((left, right) => right[1] - left[1] || (moveLabels.get(left[0]) ?? left[0]).localeCompare(moveLabels.get(right[0]) ?? right[0]))
    .slice(0, limit)
    .map(([key, value]) => ({
      label: moveLabels.get(key) ?? key,
      value: value.toFixed(3),
    }));
}

function runAntWalk(
  problem: LocalSearchProblem,
  ctx: ReturnType<typeof createContext>,
  startState: unknown,
  pheromones: Map<string, number>,
  moveLabels: Map<string, string>,
  constructionDepth: number,
  pheromoneInfluence: number,
  heuristicInfluence: number,
): AntWalkResult {
  let currentState = startState;
  let currentEvaluation = ctx.domain.evaluate(problem, currentState);
  let bestState = currentState;
  let bestEvaluation = currentEvaluation;
  let bestMove: LocalSearchCandidate | null = null;
  let bestRejectedMove: LocalSearchCandidate | null = null;
  let bestPool: LocalSearchCandidate[] = [];
  let lastSelectedMove: LocalSearchCandidate | null = null;
  let lastRejectedMove: LocalSearchCandidate | null = null;
  let lastPool: LocalSearchCandidate[] = [];
  const trail: string[] = [];

  for (let depthStep = 0; depthStep < constructionDepth; depthStep++) {
    const neighbors = sortCandidates(ctx.domain.getNeighbors(problem, currentState, ctx.random));
    ctx.neighborsEvaluated += neighbors.length;
    if (neighbors.length === 0) break;

    const pool = sampleCandidates(problem, neighbors);
    for (const candidate of pool) {
      moveLabels.set(moveKey(candidate), candidate.label);
    }

    const selected = selectAntCandidate(pool, pheromones, ctx.random, pheromoneInfluence, heuristicInfluence);
    if (!selected) break;

    const rejected = pool.find(candidate => candidate.id !== selected.id) ?? null;
    lastSelectedMove = selected;
    lastRejectedMove = rejected;
    lastPool = pool;
    trail.push(moveKey(selected));

    currentState = selected.state;
    currentEvaluation = ctx.domain.evaluate(problem, currentState);
    if (currentEvaluation.goalReached || better(currentEvaluation.score, bestEvaluation.score)) {
      bestState = currentState;
      bestEvaluation = currentEvaluation;
      bestMove = selected;
      bestRejectedMove = rejected;
      bestPool = pool;
    }

    if (currentEvaluation.goalReached) {
      break;
    }
  }

  return {
    currentState: bestState,
    bestState,
    bestScore: bestEvaluation.score,
    bestValue: bestEvaluation.value,
    bestDisplayValue: bestEvaluation.displayValue,
    bestGoalReached: bestEvaluation.goalReached,
    candidateMoves: bestPool.length > 0 ? bestPool : lastPool,
    acceptedMove: bestMove ?? lastSelectedMove,
    rejectedMove: bestRejectedMove ?? lastRejectedMove,
    trail,
  };
}

export const antColonyOptimizationRunner: LocalSearchRunner = {
  meta: {
    id: 'ant-colony-optimization',
    name: 'Ant Colony Optimization',
    shortName: 'Ant Colony',
    category: 'local-search',
    description: 'Uses pheromone trails and heuristic sampling to bias local-search moves toward better configurations.',
    longDescription: 'Ant colony optimization treats each move as a trail component that can be reinforced or evaporated over time. It is a useful swarm-intelligence baseline for showing how pheromone memory can steer a generic local-search neighborhood without hardcoding a single domain.',
    timeComplexity: 'O(g · a · d · b)',
    spaceComplexity: 'O(m)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'swarm-intelligence', 'stochastic'],
    bookChapter: 'Metaheuristics / swarm intelligence',
    relatedAlgorithms: ['simulated-annealing', 'stochastic-beam-search', 'genetic-algorithm'],
    relationshipLabel: 'swarm-guided metaheuristic',
  },
  pseudocode: [
    'function ANT-COLONY-OPTIMIZATION(problem, ants, depth):',
    '  current <- INITIAL-STATE(problem)',
    '  best <- current',
    '  pheromone <- 1 for every move',
    '  repeat for each generation:',
    '    ants <- walk depth steps using pheromone^alpha * heuristic^beta',
    '    evaporate old pheromone trails',
    '    reinforce the best ant trails',
    '    if best ant improves best: best <- best ant',
  ],
  validate(problem: LocalSearchProblem) {
    const domain = getLocalSearchDomain(problem);
    const base = domain.validate(problem);
    if (!base.valid) return base;

    const errors: string[] = [];
    if (problem.populationSize !== undefined && (!Number.isInteger(problem.populationSize) || problem.populationSize <= 0)) {
      errors.push('Ant count must be a positive integer.');
    }
    if (problem.constructionDepth !== undefined && (!Number.isInteger(problem.constructionDepth) || problem.constructionDepth <= 0)) {
      errors.push('Construction depth must be a positive integer.');
    }
    if (problem.pheromoneDecay !== undefined && (!Number.isFinite(problem.pheromoneDecay) || problem.pheromoneDecay < 0 || problem.pheromoneDecay > 1)) {
      errors.push('Pheromone decay must be a number between 0 and 1.');
    }
    if (problem.pheromoneInfluence !== undefined && (!Number.isFinite(problem.pheromoneInfluence) || problem.pheromoneInfluence < 0)) {
      errors.push('Pheromone influence must be a non-negative number.');
    }
    if (problem.heuristicInfluence !== undefined && (!Number.isFinite(problem.heuristicInfluence) || problem.heuristicInfluence < 0)) {
      errors.push('Heuristic influence must be a non-negative number.');
    }
    if (problem.eliteWeight !== undefined && (!Number.isFinite(problem.eliteWeight) || problem.eliteWeight < 1)) {
      errors.push('Elite weight must be at least 1.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return base;
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    const antCount = clampInteger(problem.populationSize, DEFAULT_POPULATION, 1, 64);
    const constructionDepth = clampInteger(problem.constructionDepth, DEFAULT_CONSTRUCTION_DEPTH, 1, 16);
    const pheromoneDecay = clampNumber(problem.pheromoneDecay, DEFAULT_PHEROMONE_DECAY, 0, 1);
    const pheromoneInfluence = clampNumber(problem.pheromoneInfluence, DEFAULT_PHEROMONE_INFLUENCE, 0, 8);
    const heuristicInfluence = clampNumber(problem.heuristicInfluence, DEFAULT_HEURISTIC_INFLUENCE, 0, 8);
    const eliteWeight = Math.max(1, clampNumber(problem.eliteWeight, DEFAULT_ELITE_WEIGHT, 1, 8));
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;
    let bestEvaluation = ctx.domain.evaluate(problem, best);
    const pheromones = new Map<string, number>();
    const moveLabels = new Map<string, string>();

    yield createStep(ctx, 'initializing', `Initialized ant colony optimization with ${antCount} ants and trail depth ${constructionDepth}.`, 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      populationSize: antCount,
      constructionDepth,
      pheromoneDecay,
      pheromoneInfluence,
      heuristicInfluence,
      eliteWeight,
      populationPreview: [],
      pheromoneStats: [],
      notes: [
        `Colony size starts at ${antCount}.`,
        `Pheromone decay removes ${(pheromoneDecay * 100).toFixed(0)}% of trail strength each generation.`,
      ],
    });

    if (bestEvaluation.goalReached) {
      return buildResult(ctx, problem, best);
    }

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const antResults = Array.from({ length: antCount }, (_, antIndex) => {
        const startState = antIndex === 0 ? current : ctx.domain.createRandomState(problem, ctx.random);
        return runAntWalk(problem, ctx, startState, pheromones, moveLabels, constructionDepth, pheromoneInfluence, heuristicInfluence);
      });

      evaporatePheromones(pheromones, pheromoneDecay);

      const orderedResults = [...antResults].sort((left, right) => right.bestScore - left.bestScore || left.bestValue - right.bestValue || left.bestDisplayValue.localeCompare(right.bestDisplayValue));
      const scoreFloor = Math.min(...orderedResults.map(result => result.bestScore));
      const scoreCeiling = Math.max(...orderedResults.map(result => result.bestScore));
      const scoreSpan = Math.max(scoreCeiling - scoreFloor, EPSILON);

      orderedResults.forEach((result, index) => {
        const quality = 1 + (result.bestScore - scoreFloor) / scoreSpan;
        const reinforcement = quality * (index === 0 ? eliteWeight : 1);
        depositTrail(pheromones, result.trail, reinforcement);
      });

      const colonyBest = orderedResults[0];
      current = colonyBest.bestState;
      if (better(colonyBest.bestScore, bestEvaluation.score) || colonyBest.bestGoalReached) {
        best = colonyBest.bestState;
        bestEvaluation = ctx.domain.evaluate(problem, best);
      }

      const candidateMoves = sampleCandidates(problem, colonyBest.candidateMoves);
      const population = populationPreview(problem, ctx, orderedResults.map(result => result.bestState));
      const pheromoneStats = buildPheromoneStats(pheromones, moveLabels);
      const description = `Generation ${iteration}: ${antCount} ants walked ${constructionDepth} steps, evaporated stale trails, and reinforced the strongest paths.`;
      const goalReached = ctx.domain.evaluate(problem, best).goalReached;

      yield createStep(ctx, goalReached ? 'found' : 'visiting', description, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves,
        acceptedMove: colonyBest.acceptedMove,
        rejectedMove: colonyBest.rejectedMove,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: goalReached ? 0 : iteration - 1,
        populationSize: antCount,
        constructionDepth,
        pheromoneDecay,
        pheromoneInfluence,
        heuristicInfluence,
        eliteWeight,
        populationPreview: population,
        pheromoneStats,
        notes: [
          `Best trail reinforcement is multiplied by ${eliteWeight.toFixed(1)} for the top ant.`,
          `Pheromone bias uses alpha=${pheromoneInfluence.toFixed(2)} and beta=${heuristicInfluence.toFixed(2)}.`,
        ],
      }, goalReached ? 'success' : 'info');

      if (goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Ant colony optimization stopped after ${maxSteps} generations.`, 8, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      populationSize: antCount,
      constructionDepth,
      pheromoneDecay,
      pheromoneInfluence,
      heuristicInfluence,
      eliteWeight,
      populationPreview: populationPreview(problem, ctx, [best, current]),
      pheromoneStats: buildPheromoneStats(pheromones, moveLabels),
      notes: ['Try adjusting the colony size, pheromone decay, or construction depth to change the search trajectory.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};