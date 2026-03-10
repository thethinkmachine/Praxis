import { DEFAULT_MAX_STEPS, better, shuffle } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const hillClimbingFirstChoiceRunner: LocalSearchRunner = {
  meta: {
    id: 'hill-climbing-first-choice',
    name: 'First-Choice Hill Climbing',
    shortName: 'First-Choice',
    category: 'local-search',
    description: 'Samples neighbors in random order and commits to the first one that improves the current state.',
    longDescription: 'First-choice hill climbing avoids evaluating the entire neighborhood. It randomizes the search order and takes the first improving move it sees, making it cheaper but more path-dependent than steepest ascent.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(1)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'hill-climbing', 'stochastic'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-simple', 'hill-climbing-stochastic'],
  },
  pseudocode: [
    'function FIRST-CHOICE-HILL-CLIMBING(problem):',
    '  current <- INITIAL-STATE(problem)',
    '  loop:',
    '    for each neighbor in RANDOM-ORDER(NEIGHBORS(current)):',
    '      if score(neighbor) > score(current):',
    '        current <- neighbor',
    '        continue loop',
    '    return current',
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

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized first-choice hill climbing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['Neighbors are shuffled before the scan begins.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const currentScore = ctx.domain.evaluate(problem, current).score;
      const shuffled = shuffle(ctx.domain.getNeighbors(problem, current, ctx.random), ctx.random);
      const scanned: typeof shuffled = [];
      let accepted = null;
      for (const neighbor of shuffled) {
        scanned.push(neighbor);
        if (better(neighbor.score, currentScore)) {
          accepted = neighbor;
          break;
        }
      }
      ctx.neighborsEvaluated += scanned.length;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: sampled neighbors in random order until the first improvement appeared.`, 3, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: scanned,
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        notes: ['Random ordering can help this variant escape the same deterministic choice pattern.'],
      });

      if (!accepted) {
        yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'failed', ctx.domain.evaluate(problem, current).goalReached
          ? `Reached a goal state after ${iteration - 1} improving move${iteration === 1 ? '' : 's'}.`
          : 'No improving neighbor was found in the random scan, so the algorithm stopped.', 6, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: scanned,
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: iteration - 1,
          notes: ['Unlike steepest-ascent, this variant never sees the full neighborhood if it finds an early improvement.'],
        }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'warn');
        return buildResult(ctx, problem, best);
      }

      current = accepted.state;
      if (better(accepted.score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Accepted the first improving move: ${accepted.label}.`, 5, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: scanned,
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        notes: ['The scan stopped immediately once an improvement was discovered.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `First-choice hill climbing stopped after ${maxSteps} iterations.`, 7, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      notes: ['A different seed changes which improving moves are encountered first.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
