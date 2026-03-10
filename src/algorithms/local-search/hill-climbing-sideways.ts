import { DEFAULT_MAX_STEPS, better, equalScore } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates, sortCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const hillClimbingSidewaysRunner: LocalSearchRunner = {
  meta: {
    id: 'hill-climbing-sideways',
    name: 'Hill Climbing With Sideways Moves',
    shortName: 'Sideways Hill',
    category: 'local-search',
    description: 'Allows a bounded number of equal-score moves so the search can traverse plateaus.',
    longDescription: 'Sideways moves let hill climbing step across flat plateaus where every immediate successor has the same score. The cap matters because unlimited sideways motion can lead to loops.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(b)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'hill-climbing', 'plateau'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-steepest', 'hill-climbing-random-restart'],
  },
  pseudocode: [
    'function SIDEWAYS-HILL-CLIMBING(problem, limit):',
    '  current <- INITIAL-STATE(problem)',
    '  sideways <- 0',
    '  loop:',
    '    next <- argmax score(NEIGHBORS(current))',
    '    if score(next) < score(current): return current',
    '    if score(next) = score(current) and sideways = limit: return current',
    '    sideways <- sideways + 1 if score(next) = score(current) else 0',
    '    current <- next',
  ],
  validate(problem: LocalSearchProblem) {
    return getLocalSearchDomain(problem).validate(problem);
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    const sidewaysLimit = problem.sidewaysMoveLimit ?? 12;
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;
    let sidewaysMoves = 0;
    let plateauLength = 0;

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized sideways-move hill climbing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength,
      stagnationSteps: 0,
      sidewaysMovesUsed: sidewaysMoves,
      sidewaysMoveLimit: sidewaysLimit,
      notes: ['Equal-score moves are allowed, but only up to the configured plateau cap.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const currentScore = ctx.domain.evaluate(problem, current).score;
      const neighbors = sortCandidates(ctx.domain.getNeighbors(problem, current, ctx.random));
      const accepted = neighbors[0] ?? null;
      ctx.neighborsEvaluated += neighbors.length;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: scored the neighborhood and checked whether the best successor improves or only matches the current score.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength,
        stagnationSteps: plateauLength,
        sidewaysMovesUsed: sidewaysMoves,
        sidewaysMoveLimit: sidewaysLimit,
        notes: ['Plateau motion is explicit in this trace because equal-score moves are treated specially.'],
      });

      if (!accepted || (!better(accepted.score, currentScore) && !equalScore(accepted.score, currentScore))) {
        yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'failed', ctx.domain.evaluate(problem, current).goalReached
          ? `Reached a goal after ${iteration - 1} move${iteration === 1 ? '' : 's'}.`
          : 'The best neighbor was strictly worse, so the search stopped.', 5, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: sampleCandidates(problem, neighbors),
          rejectedMove: accepted,
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength,
          stagnationSteps: plateauLength,
          sidewaysMovesUsed: sidewaysMoves,
          sidewaysMoveLimit: sidewaysLimit,
          notes: ['A sideways-capable hill climber still refuses downhill moves.'],
        }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'warn');
        return buildResult(ctx, problem, best);
      }

      if (equalScore(accepted.score, currentScore)) {
        if (sidewaysMoves >= sidewaysLimit) {
          yield createStep(ctx, 'failed', `The plateau cap (${sidewaysLimit}) was exhausted, so the run stopped instead of looping sideways forever.`, 6, {
            problem,
            currentState: current,
            bestState: best,
            candidateMoves: sampleCandidates(problem, neighbors),
            rejectedMove: accepted,
            iteration: iteration - 1,
            restartCount: 0,
            plateauLength,
            stagnationSteps: plateauLength,
            sidewaysMovesUsed: sidewaysMoves,
            sidewaysMoveLimit: sidewaysLimit,
            notes: ['This is the main tradeoff: more plateau freedom also increases the risk of cycling.'],
          }, 'warn');
          return buildResult(ctx, problem, best);
        }
        sidewaysMoves++;
        plateauLength++;
      } else {
        sidewaysMoves = 0;
        plateauLength = 0;
      }

      current = accepted.state;
      if (better(accepted.score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Accepted ${accepted.label}. ${equalScore(accepted.score, currentScore) ? 'This was a sideways move across a plateau.' : 'This was a genuine improvement.'}`, 7, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength,
        stagnationSteps: plateauLength,
        sidewaysMovesUsed: sidewaysMoves,
        sidewaysMoveLimit: sidewaysLimit,
        notes: [equalScore(accepted.score, currentScore) ? 'Plateau traversal continues.' : 'The plateau counter resets after a true improvement.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Stopped after reaching the iteration limit (${maxSteps}).`, 8, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength,
      stagnationSteps: plateauLength,
      sidewaysMovesUsed: sidewaysMoves,
      sidewaysMoveLimit: sidewaysLimit,
      notes: ['Consider random restarts if plateaus keep consuming the budget.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
