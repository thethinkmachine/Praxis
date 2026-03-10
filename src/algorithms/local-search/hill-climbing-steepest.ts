import { DEFAULT_MAX_STEPS, better } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates, sortCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const hillClimbingSteepestRunner: LocalSearchRunner = {
  meta: {
    id: 'hill-climbing-steepest',
    name: 'Steepest-Ascent Hill Climbing',
    shortName: 'Steepest Hill',
    category: 'local-search',
    description: 'Evaluates the full neighborhood and moves to the best improving successor.',
    longDescription: 'Steepest-ascent hill climbing scores the complete neighborhood at each step, then chooses the strongest immediate improvement. It makes local maxima and plateaus very visible because it has no escape mechanism.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(b)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'hill-climbing', 'greedy'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-simple', 'hill-climbing-first-choice', 'hill-climbing-random-restart'],
  },
  pseudocode: [
    'function STEEPEST-HILL-CLIMBING(problem):',
    '  current <- INITIAL-STATE(problem)',
    '  best <- current',
    '  loop:',
    '    neighbors <- ALL-NEIGHBORS(current)',
    '    next <- argmax score(neighbors)',
    '    if score(next) <= score(current): return best',
    '    current <- next',
    '    if score(current) > score(best): best <- current',
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

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized steepest-ascent hill climbing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['Every neighbor is scored before the move is chosen.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const neighbors = sortCandidates(ctx.domain.getNeighbors(problem, current, ctx.random));
      const accepted = neighbors[0] ?? null;
      ctx.neighborsEvaluated += neighbors.length;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: scored the full neighborhood and ranked successors from best to worst.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        notes: ['This variant pays the most per step but makes the decision rule explicit.'],
      });

      if (!accepted || !better(accepted.score, ctx.domain.evaluate(problem, current).score)) {
        yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'failed', ctx.domain.evaluate(problem, current).goalReached
          ? `Reached a goal state after ${iteration - 1} move${iteration === 1 ? '' : 's'}.`
          : `The best neighbor was not better than the current state, so the search stopped at a local optimum.`, 6, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: sampleCandidates(problem, neighbors),
          rejectedMove: accepted,
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: iteration - 1,
          notes: ['Steepest-ascent halts when the neighborhood offers no improvement.'],
        }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'warn');
        return buildResult(ctx, problem, best);
      }

      current = accepted.state;
      if (better(accepted.score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Accepted ${accepted.label}; ${ctx.domain.objectiveLabel.toLowerCase()} is now ${ctx.domain.evaluate(problem, current).displayValue}.`, 7, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        notes: ['The strongest improving successor became the new current state.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Steepest-ascent hit the iteration limit (${maxSteps}).`, 8, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      notes: ['Try restarts, annealing, or beam search when greedy ascent stalls.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
