import { DEFAULT_MAX_STEPS, better } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates, sortCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const hillClimbingRandomRestartRunner: LocalSearchRunner = {
  meta: {
    id: 'hill-climbing-random-restart',
    name: 'Random-Restart Hill Climbing',
    shortName: 'Restart Hill',
    category: 'local-search',
    description: 'Runs hill climbing repeatedly from fresh random initial states until one run succeeds or the restart budget is exhausted.',
    longDescription: 'Random restarts convert a brittle local method into a practical strategy by repeatedly sampling different basins of attraction. It is one of the clearest demonstrations that failure in local search often comes from initialization rather than the move rule alone.',
    timeComplexity: 'O(r · k · b)',
    spaceComplexity: 'O(b)',
    complete: 'Probabilistically with unbounded restarts',
    optimal: false,
    tags: ['local-search', 'hill-climbing', 'restart'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['hill-climbing-steepest', 'min-conflicts'],
  },
  pseudocode: [
    'function RANDOM-RESTART-HILL-CLIMBING(problem, restarts):',
    '  best <- null',
    '  for restart in 0..restarts:',
    '    current <- RANDOM-STATE(problem)',
    '    current <- HILL-CLIMB(current)',
    '    if best is null or score(current) > score(best): best <- current',
    '    if current is goal: return current',
    '  return best',
  ],
  validate(problem: LocalSearchProblem) {
    return getLocalSearchDomain(problem).validate(problem);
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    const restartLimit = problem.restartLimit ?? 8;
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized random-restart hill climbing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['Each restart samples a new initial basin before hill climbing resumes.'],
    });

    let globalIteration = 0;
    for (let restart = 0; restart <= restartLimit; restart++) {
      if (restart > 0) {
        current = ctx.domain.createRandomState(problem, ctx.random);
        yield createStep(ctx, 'visiting', `Restart ${restart}: sampled a fresh initial state to escape the previous local optimum.`, 3, {
          problem,
          currentState: current,
          bestState: best,
          iteration: globalIteration,
          restartCount: restart,
          plateauLength: 0,
          stagnationSteps: 0,
          notes: ['Random restarts trade more global coverage for more total evaluations.'],
        });
      }

      for (let localIteration = 1; localIteration <= maxSteps; localIteration++) {
        globalIteration++;
        const neighbors = sortCandidates(ctx.domain.getNeighbors(problem, current, ctx.random));
        const accepted = neighbors[0] ?? null;
        ctx.neighborsEvaluated += neighbors.length;

        yield createStep(ctx, 'expanding', `Restart ${restart}, iteration ${localIteration}: ranked the current neighborhood before deciding whether to move or restart later.`, 4, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: sampleCandidates(problem, neighbors),
          acceptedMove: accepted,
          iteration: globalIteration,
          restartCount: restart,
          plateauLength: 0,
          stagnationSteps: localIteration - 1,
          notes: ['This inner loop behaves like steepest-ascent hill climbing.'],
        });

        if (!accepted || !better(accepted.score, ctx.domain.evaluate(problem, current).score)) {
          yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'failed', ctx.domain.evaluate(problem, current).goalReached
            ? `Restart ${restart} reached a goal after ${localIteration - 1} move${localIteration === 1 ? '' : 's'}.`
            : `Restart ${restart} stalled at a local optimum; the outer loop will decide whether to try another basin.`, 5, {
            problem,
            currentState: current,
            bestState: best,
            candidateMoves: sampleCandidates(problem, neighbors),
            rejectedMove: accepted,
            iteration: globalIteration,
            restartCount: restart,
            plateauLength: 0,
            stagnationSteps: localIteration - 1,
            notes: ['The outer loop is the escape mechanism.'],
          }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'warn');
          if (ctx.domain.evaluate(problem, current).goalReached) {
            if (better(ctx.domain.evaluate(problem, current).score, ctx.domain.evaluate(problem, best).score)) best = current;
            return buildResult(ctx, problem, best);
          }
          break;
        }

        current = accepted.state;
        if (better(ctx.domain.evaluate(problem, current).score, ctx.domain.evaluate(problem, best).score)) best = current;

        yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Accepted ${accepted.label} during restart ${restart}.`, 4, {
          problem,
          currentState: current,
          bestState: best,
          candidateMoves: sampleCandidates(problem, neighbors),
          acceptedMove: accepted,
          iteration: globalIteration,
          restartCount: restart,
          plateauLength: 0,
          stagnationSteps: 0,
          notes: ['Best-so-far is tracked across all restarts, not just the current run.'],
        }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

        if (ctx.domain.evaluate(problem, current).goalReached) {
          return buildResult(ctx, problem, best);
        }
      }
    }

    yield createStep(ctx, 'failed', `Exhausted the restart budget (${restartLimit}) with best ${ctx.domain.objectiveLabel.toLowerCase()} ${ctx.domain.evaluate(problem, best).displayValue}.`, 7, {
      problem,
      currentState: current,
      bestState: best,
      iteration: globalIteration,
      restartCount: restartLimit,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['More restarts increase the chance of landing in a good basin.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
