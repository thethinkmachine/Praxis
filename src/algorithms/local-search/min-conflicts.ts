import { DEFAULT_MAX_STEPS, better, shuffle } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates, sortCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const minConflictsRunner: LocalSearchRunner = {
  meta: {
    id: 'min-conflicts',
    name: 'Min-Conflicts',
    shortName: 'Min-Conflicts',
    category: 'local-search',
    description: 'Repairs one conflicted variable at a time by selecting the value that minimizes the resulting constraint violations.',
    longDescription: 'Min-conflicts is the flagship repair-based local-search method for CSP-style problems. Instead of evaluating every move from the whole state, it focuses directly on conflicted variables and repairs them greedily.',
    timeComplexity: 'O(k · d)',
    spaceComplexity: 'O(d)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'repair', 'csp'],
    bookChapter: 'AIMA 4th Ed. § 4.6',
    relatedAlgorithms: ['hill-climbing-random-restart'],
  },
  pseudocode: [
    'function MIN-CONFLICTS(problem, maxSteps):',
    '  current <- INITIAL-STATE(problem)',
    '  for step in 1..maxSteps:',
    '    if current is a goal: return current',
    '    repairs <- REPAIRS-FOR-A-CONFLICTED-VARIABLE(current)',
    '    current <- argmax score(repairs)',
    '  return current',
  ],
  validate(problem: LocalSearchProblem) {
    const domain = getLocalSearchDomain(problem);
    const base = domain.validate(problem);
    if (!base.valid) return base;
    if (!domain.getRepairCandidates) {
      return {
        valid: false,
        errors: [`${domain.label} does not expose a min-conflicts repair operator.`],
      };
    }
    return base;
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized min-conflicts on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      notes: ['This repair-based method only works on domains that expose conflicted variables.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      if (ctx.domain.evaluate(problem, current).goalReached) {
        yield createStep(ctx, 'found', `Solved the problem after ${iteration - 1} repair step${iteration === 1 ? '' : 's'}.`, 3, {
          problem,
          currentState: current,
          bestState: best,
          iteration: iteration - 1,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: 0,
          notes: ['All conflicts have been removed.'],
        }, 'success');
        return buildResult(ctx, problem, best);
      }

      const repairs = sortCandidates(ctx.domain.getRepairCandidates?.(problem, current, ctx.random) ?? []);
      const accepted = repairs.length > 0 ? shuffle(repairs.filter(repair => repair.score === repairs[0].score), ctx.random)[0] : null;
      ctx.neighborsEvaluated += repairs.length;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: focused on one conflicted variable and scored only its repair options.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, repairs),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        notes: ['Min-conflicts narrows the neighborhood to the local repair choices that matter most.'],
      });

      if (!accepted) {
        yield createStep(ctx, 'failed', 'No repair candidates were available for the chosen state.', 5, {
          problem,
          currentState: current,
          bestState: best,
          iteration,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: iteration - 1,
          notes: ['This usually indicates the domain does not match the repair operator assumptions.'],
        }, 'warn');
        return buildResult(ctx, problem, best);
      }

      current = accepted.state;
      if (better(accepted.score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Applied repair ${accepted.label}.`, 5, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, repairs),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        notes: ['Ties are broken randomly to avoid deterministic cycles in symmetric CSPs.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Reached the configured repair limit (${maxSteps}) without solving the problem.`, 6, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      notes: ['Changing the seed or using a different initial state often changes the repair trajectory.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
