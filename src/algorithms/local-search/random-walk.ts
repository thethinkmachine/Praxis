import { DEFAULT_MAX_STEPS } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const randomWalkRunner: LocalSearchRunner = {
  meta: {
    id: 'random-walk',
    name: 'Random Walk Baseline',
    shortName: 'Random Walk',
    category: 'local-search',
    description: 'Samples the neighborhood uniformly at random to provide a baseline against more informed local-search strategies.',
    longDescription: 'Random walk ignores objective-driven choice and simply drifts through the state space. It is useful as a baseline because every smarter local-search method should show where it gains leverage beyond blind exploration.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(1)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'baseline', 'stochastic'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-simple', 'simulated-annealing'],
  },
  pseudocode: [
    'function RANDOM-WALK(problem, maxSteps):',
    '  current <- INITIAL-STATE(problem)',
    '  best <- current',
    '  for step in 1..maxSteps:',
    '    if current is a goal: return best',
    '    next <- RANDOM-NEIGHBOR(current)',
    '    current <- next',
    '    if score(current) > score(best): best <- current',
    '  return best',
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

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized random walk on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['This baseline ignores objective values when picking the next state.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const currentEval = ctx.domain.evaluate(problem, current);
      if (currentEval.goalReached) {
        yield createStep(ctx, 'found', `Reached a goal state after ${iteration - 1} random step${iteration === 1 ? '' : 's'}.`, 4, {
          problem,
          currentState: current,
          bestState: best,
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: 0,
          notes: ['Even blind drift can occasionally hit the goal on small landscapes.'],
        }, 'success');
        return buildResult(ctx, problem, best);
      }

      const neighbors = ctx.domain.getNeighbors(problem, current, ctx.random);
      ctx.neighborsEvaluated += neighbors.length;
      const accepted = ctx.domain.getRandomNeighbor?.(problem, current, ctx.random) ?? neighbors[Math.floor(ctx.random() * neighbors.length)];
      if (!accepted) break;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: sampled the neighborhood and picked the next state uniformly at random.`, 5, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        notes: ['Any improvement over this baseline comes from choice, not just more motion.'],
      });

      current = accepted.state;
      if (ctx.domain.evaluate(problem, current).score > ctx.domain.evaluate(problem, best).score) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Random walk moved to ${ctx.domain.describeState(problem, current)}.`, 6, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        notes: ['The current state changes even when the move is worse.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');
    }

    yield createStep(ctx, 'failed', `Random walk stopped after ${maxSteps} iterations with best ${ctx.domain.objectiveLabel.toLowerCase()} ${ctx.domain.evaluate(problem, best).displayValue}.`, 8, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      notes: ['Use this run as a baseline when comparing more informed strategies.'],
    }, 'warn');

    return buildResult(ctx, problem, best);
  },
};
