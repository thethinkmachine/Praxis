import { DEFAULT_MAX_STEPS, DEFAULT_TABU_TENURE, better } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates, sortCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const tabuSearchRunner: LocalSearchRunner = {
  meta: {
    id: 'tabu-search',
    name: 'Tabu Search',
    shortName: 'Tabu',
    category: 'local-search',
    description: 'Uses short-term memory to forbid recently visited moves or states, reducing immediate cycling.',
    longDescription: 'Tabu search adds memory to local search. Instead of trusting the landscape alone, it records recent moves and temporarily marks them taboo so the run cannot bounce back and forth between the same local configurations.',
    timeComplexity: 'O(k · b)',
    spaceComplexity: 'O(t)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'memory', 'tabu'],
    bookChapter: 'Metaheuristics / local search extensions',
    relatedAlgorithms: ['hill-climbing-sideways', 'simulated-annealing'],
  },
  pseudocode: [
    'function TABU-SEARCH(problem, tenure):',
    '  current <- INITIAL-STATE(problem)',
    '  tabu <- empty queue',
    '  best <- current',
    '  loop:',
    '    choose best neighbor not in tabu, unless it improves best',
    '    current <- neighbor',
    '    add move/state to tabu',
    '    if score(current) > score(best): best <- current',
  ],
  validate(problem: LocalSearchProblem) {
    return getLocalSearchDomain(problem).validate(problem);
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    const tabuTenure = problem.tabuTenure ?? DEFAULT_TABU_TENURE;
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;
    const tabuQueue: string[] = [];

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized tabu search on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      tabuSize: 0,
      tabuEntries: [],
      notes: ['Short-term memory is empty at the start of the run.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const neighbors = sortCandidates(ctx.domain.getNeighbors(problem, current, ctx.random));
      ctx.neighborsEvaluated += neighbors.length;
      const bestScore = ctx.domain.evaluate(problem, best).score;
      const accepted = neighbors.find(candidate => {
        const key = candidate.moveKey ?? ctx.domain.serializeState(problem, candidate.state);
        return !tabuQueue.includes(key) || better(candidate.score, bestScore);
      }) ?? null;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: scored the neighborhood and filtered it through the tabu list of recent moves.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        tabuSize: tabuQueue.length,
        tabuEntries: [...tabuQueue],
        notes: ['Aspiration allows a tabu move if it improves the global best state.'],
      });

      if (!accepted) {
        yield createStep(ctx, 'failed', 'No admissible non-tabu move remained in the neighborhood.', 5, {
          problem,
          currentState: current,
          bestState: best,
          iteration,
          restartCount: 0,
          plateauLength: 0,
          stagnationSteps: iteration - 1,
          tabuSize: tabuQueue.length,
          tabuEntries: [...tabuQueue],
          notes: ['A shorter tabu tenure or a larger neighborhood may restore mobility.'],
        }, 'warn');
        return buildResult(ctx, problem, best);
      }

      current = accepted.state;
      const tabuKey = accepted.moveKey ?? ctx.domain.serializeState(problem, current);
      tabuQueue.push(tabuKey);
      while (tabuQueue.length > tabuTenure) tabuQueue.shift();
      if (better(ctx.domain.evaluate(problem, current).score, bestScore)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', `Accepted ${accepted.label} and marked ${tabuKey} tabu for the next ${tabuTenure} step${tabuTenure === 1 ? '' : 's'}.`, 6, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        tabuSize: tabuQueue.length,
        tabuEntries: [...tabuQueue],
        notes: ['Tabu memory blocks immediate reversals and short cycles.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Tabu search stopped after ${maxSteps} iterations.`, 7, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      tabuSize: tabuQueue.length,
      tabuEntries: [...tabuQueue],
      notes: ['Tabu search can keep moving after hill climbing stalls, but it still depends on tenure tuning.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
