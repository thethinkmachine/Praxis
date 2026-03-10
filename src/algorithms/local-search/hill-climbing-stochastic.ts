import { DEFAULT_MAX_STEPS, better, selectWeightedCandidate } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates, sortCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const hillClimbingStochasticRunner: LocalSearchRunner = {
  meta: {
    id: 'hill-climbing-stochastic',
    name: 'Stochastic Hill Climbing',
    shortName: 'Stochastic Hill',
    category: 'local-search',
    description: 'Chooses randomly among improving neighbors, biasing selection toward stronger improvements.',
    longDescription: 'Stochastic hill climbing keeps the greedy requirement that moves must improve the score, but it adds randomness by sampling among all improving neighbors instead of always taking the single best one.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(b)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'hill-climbing', 'stochastic'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-first-choice', 'simulated-annealing'],
  },
  pseudocode: [
    'function STOCHASTIC-HILL-CLIMBING(problem):',
    '  current <- INITIAL-STATE(problem)',
    '  loop:',
    '    improving <- {n in NEIGHBORS(current) : score(n) > score(current)}',
    '    if improving is empty: return current',
    '    current <- RANDOM-WEIGHTED-CHOICE(improving)',
  ],
  validate(problem: LocalSearchProblem) {
    return getLocalSearchDomain(problem).validate(problem);
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized stochastic hill climbing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['Only improving moves are eligible, but the choice among them is randomized.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const currentScore = ctx.domain.evaluate(problem, current).score;
      const neighbors = sortCandidates(ctx.domain.getNeighbors(problem, current, ctx.random));
      const improving = neighbors.filter(candidate => better(candidate.score, currentScore));
      ctx.neighborsEvaluated += neighbors.length;
      const accepted = improving.length > 0 ? selectWeightedCandidate(improving, ctx.random) : null;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: scored the neighborhood and sampled among all improving moves.`, 3, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        notes: ['Stronger improvements receive higher probability, but they are not guaranteed.'],
      });

      if (!accepted) {
        yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'failed', ctx.domain.evaluate(problem, current).goalReached
          ? `Reached a goal after ${iteration - 1} stochastic move${iteration === 1 ? '' : 's'}.`
          : 'No improving move remained, so the algorithm stopped at a local optimum.', 4, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: sampleCandidates(problem, neighbors),
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: iteration - 1,
          notes: ['This variant still cannot accept sideways or downhill moves.'],
        }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'warn');
        return buildResult(ctx, problem, best);
      }

      current = accepted.state;
      if (better(accepted.score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Sampled improving move ${accepted.label}.`, 5, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        notes: ['Randomized improvement can reveal alternate ascent paths on the same landscape.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Stochastic hill climbing stopped after ${maxSteps} iterations.`, 5, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      notes: ['A new seed can produce a different ascent trajectory.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
