import { DEFAULT_BEAM_WIDTH, DEFAULT_MAX_STEPS, better, selectWeightedCandidate } from './core';
import { bestOf, buildResult, createContext, createStep, getInitialState, populationPreview, sampleCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const stochasticBeamSearchRunner: LocalSearchRunner = {
  meta: {
    id: 'stochastic-beam-search',
    name: 'Stochastic Beam Search',
    shortName: 'Stochastic Beam',
    category: 'local-search',
    description: 'Keeps a beam of states, but samples the next generation probabilistically instead of taking only the top k successors.',
    longDescription: 'Stochastic beam search preserves beam diversity better than deterministic beam search by sampling promising successors rather than copying only the strict top k. It is a useful bridge between beam search and genetic algorithms.',
    timeComplexity: 'O(k · b · g)',
    spaceComplexity: 'O(k)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'beam', 'stochastic'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['local-beam-search', 'genetic-algorithm'],
  },
  pseudocode: [
    'function STOCHASTIC-BEAM-SEARCH(problem, k):',
    '  beam <- k random states',
    '  loop:',
    '    successors <- UNION(NEIGHBORS(s) for s in beam)',
    '    beam <- SAMPLE-WEIGHTED(successors, k)',
    '    if best-of(beam) is goal: return best-of(beam)',
  ],
  validate(problem: LocalSearchProblem) {
    return getLocalSearchDomain(problem).validate(problem);
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const maxSteps = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    const beamWidth = problem.beamWidth ?? DEFAULT_BEAM_WIDTH;
    let beam = Array.from({ length: beamWidth }, () => ctx.domain.createRandomState(problem, ctx.random));
    let best = bestOf(problem, ctx, beam);
    let current = best;

    yield createStep(ctx, 'initializing', `Initialized stochastic beam search with beam width ${beamWidth}.`, 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      beamWidth,
      generation: 0,
      populationSize: beam.length,
      populationPreview: populationPreview(problem, ctx, beam),
      notes: ['Successors are sampled probabilistically to preserve diversity in the beam.'],
    });

    for (let generation = 1; generation <= maxSteps; generation++) {
      const successors = beam
        .flatMap(state => ctx.domain.getNeighbors(problem, state, ctx.random))
        .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
      ctx.neighborsEvaluated += successors.length;
      if (successors.length === 0) break;
      const nextBeam: unknown[] = [];
      const pool = [...successors];
      while (nextBeam.length < beamWidth && pool.length > 0) {
        const chosen = selectWeightedCandidate(pool, ctx.random);
        nextBeam.push(chosen.state);
        const chosenKey = ctx.domain.serializeState(problem, chosen.state);
        for (let index = pool.length - 1; index >= 0; index--) {
          if (ctx.domain.serializeState(problem, pool[index].state) === chosenKey) pool.splice(index, 1);
        }
      }
      beam = nextBeam.length > 0 ? nextBeam : beam;
      current = bestOf(problem, ctx, beam);
      if (better(ctx.domain.evaluate(problem, current).score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, best).goalReached ? 'found' : 'visiting', `Generation ${generation}: sampled the next beam from the successor pool with probability proportional to score.`, 3, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, successors),
        iteration: generation,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        beamWidth,
        generation,
        populationSize: beam.length,
        populationPreview: populationPreview(problem, ctx, beam),
        notes: ['Lower-ranked successors can survive, which keeps the beam from collapsing too fast.'],
      }, ctx.domain.evaluate(problem, best).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, best).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Stochastic beam search stopped after ${maxSteps} generations.`, 4, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      beamWidth,
      generation: maxSteps,
      populationSize: beam.length,
      populationPreview: populationPreview(problem, ctx, beam),
      notes: ['Sampling helps diversity, but it also means some excellent successors may be skipped.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
