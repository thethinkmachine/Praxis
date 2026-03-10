import { DEFAULT_MAX_STEPS, better } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const hillClimbingSimpleRunner: LocalSearchRunner = {
  meta: {
    id: 'hill-climbing-simple',
    name: 'Simple Hill Climbing',
    shortName: 'Simple Hill',
    category: 'local-search',
    description: 'Scans neighbors in a fixed order and takes the first move that improves the current state.',
    longDescription: 'Simple hill climbing is greedier than a full best-neighbor search. It commits as soon as it finds any improvement, making it easier to understand but more sensitive to neighbor ordering.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(1)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'hill-climbing', 'greedy'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-steepest', 'hill-climbing-first-choice'],
  },
  pseudocode: [
    'function SIMPLE-HILL-CLIMBING(problem):',
    '  current <- INITIAL-STATE(problem)',
    '  best <- current',
    '  loop:',
    '    for each neighbor in NEIGHBORS(current):',
    '      if score(neighbor) > score(current):',
    '        current <- neighbor',
    '        if score(current) > score(best): best <- current',
    '        continue loop',
    '    return best',
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

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized simple hill climbing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['The first improving neighbor wins; the rest of the neighborhood is ignored.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const currentScore = ctx.domain.evaluate(problem, current).score;
      const neighbors = ctx.domain.getNeighbors(problem, current, ctx.random);
      let accepted = null;
      const scanned = [];
      for (const neighbor of neighbors) {
        scanned.push(neighbor);
        if (better(neighbor.score, currentScore)) {
          accepted = neighbor;
          break;
        }
      }
      ctx.neighborsEvaluated += scanned.length;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: scanned neighbors in order until the first improving move was found.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: scanned,
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        notes: ['Neighbor ordering matters because the scan stops early.'],
      });

      if (!accepted) {
        yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'failed', ctx.domain.evaluate(problem, current).goalReached
          ? `Reached a goal after ${iteration - 1} improving move${iteration === 1 ? '' : 's'}.`
          : `No improving neighbor was encountered, so the search stopped at a local optimum.`, 8, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: scanned,
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: iteration - 1,
          notes: ['Simple hill climbing halts as soon as the scan finds no improvement.'],
        }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'warn');
        return buildResult(ctx, problem, best);
      }

      current = accepted.state;
      if (better(accepted.score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Accepted ${accepted.label}; ${ctx.domain.objectiveLabel.toLowerCase()} is now ${ctx.domain.evaluate(problem, current).displayValue}.`, 6, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: scanned,
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        notes: ['The move was taken immediately once it improved the score.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Stopped after reaching the configured iteration limit (${maxSteps}).`, 9, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      notes: ['The configured step budget ended before the algorithm converged.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
