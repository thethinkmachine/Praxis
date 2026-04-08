import type { LocalSearchProblem } from '@/types/problem';
import type { LocalSearchCandidate } from '@/problems/local-search/types';
import type { LocalSearchContext } from './shared';

export const DEFAULT_MAX_STEPS = 160;
export const DEFAULT_BEAM_WIDTH = 4;
export const DEFAULT_TABU_TENURE = 7;
export const DEFAULT_POPULATION = 16;
export const DEFAULT_MUTATION_RATE = 0.18;
export const DEFAULT_CROSSOVER_RATE = 0.85;
export const DEFAULT_INITIAL_TEMPERATURE = 12;
export const DEFAULT_COOLING_RATE = 0.94;
export const DEFAULT_CONSTRUCTION_DEPTH = 4;
export const DEFAULT_PHEROMONE_DECAY = 0.25;
export const DEFAULT_PHEROMONE_INFLUENCE = 1.2;
export const DEFAULT_HEURISTIC_INFLUENCE = 2;
export const DEFAULT_ELITE_WEIGHT = 1.5;

export function better(leftScore: number, rightScore: number): boolean {
  return leftScore > rightScore;
}

export function equalScore(leftScore: number, rightScore: number): boolean {
  return Math.abs(leftScore - rightScore) < 1e-9;
}

export function updateBest(problem: LocalSearchProblem, ctx: LocalSearchContext, currentBest: unknown, candidate: unknown): unknown {
  const currentScore = ctx.domain.evaluate(problem, currentBest).score;
  const candidateScore = ctx.domain.evaluate(problem, candidate).score;
  return better(candidateScore, currentScore) ? candidate : currentBest;
}

export function sortByScoreDescending(problem: LocalSearchProblem, ctx: LocalSearchContext, states: unknown[]): unknown[] {
  return [...states].sort((left, right) => ctx.domain.evaluate(problem, right).score - ctx.domain.evaluate(problem, left).score);
}

export function selectWeightedCandidate(candidates: LocalSearchCandidate[], random: () => number): LocalSearchCandidate {
  const minScore = Math.min(...candidates.map(candidate => candidate.score));
  const weights = candidates.map(candidate => Math.max(candidate.score - minScore + 1, 0.01));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = random() * total;
  for (let index = 0; index < candidates.length; index++) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function tournamentSelect(problem: LocalSearchProblem, ctx: LocalSearchContext, states: unknown[], random: () => number, size = 3): unknown {
  const candidates = shuffle(states, random).slice(0, Math.min(size, states.length));
  return sortByScoreDescending(problem, ctx, candidates)[0];
}
