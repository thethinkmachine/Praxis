import { DEFAULT_BEAM_WIDTH, DEFAULT_MAX_STEPS, better, sortByScoreDescending } from './core';
import { bestOf, buildResult, createContext, createStep, getInitialState, populationPreview, sampleCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const localBeamSearchRunner: LocalSearchRunner = {
  meta: {
    id: 'local-beam-search',
    name: 'Local Beam Search',
    shortName: 'Beam Search',
    category: 'local-search',
    description: 'Keeps the top k states at each generation and replaces the beam with the best successors found across all beams.',
    longDescription: 'Local beam search broadens local search from one active state to several. Instead of restarting from scratch, it lets multiple promising states compete in the same generation.',
    timeComplexity: 'O(k · b · g)',
    spaceComplexity: 'O(k)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'beam', 'population'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['stochastic-beam-search', 'genetic-algorithm'],
  },
  pseudocode: [
    'function LOCAL-BEAM-SEARCH(problem, k):',
    '  beam <- k random states',
    '  best <- best-of(beam)',
    '  loop:',
    '    successors <- UNION(NEIGHBORS(s) for s in beam)',
    '    beam <- top-k(successors)',
    '    if best-of(beam) improves best: best <- best-of(beam)',
    '    if best is goal: return best',
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

    yield createStep(ctx, 'initializing', `Initialized local beam search with beam width ${beamWidth}.`, 1, {
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
      notes: ['Beam search keeps multiple live states instead of one current state.'],
    });

    for (let generation = 1; generation <= maxSteps; generation++) {
      if (ctx.domain.evaluate(problem, best).goalReached) {
        return buildResult(ctx, problem, best);
      }

      const successors = beam.flatMap(state => ctx.domain.getNeighbors(problem, state, ctx.random));
      ctx.neighborsEvaluated += successors.length;
      const nextBeam = sortByScoreDescending(problem, ctx, successors.map(candidate => candidate.state))
        .filter((state, index, array) => array.findIndex(other => ctx.domain.serializeState(problem, other) === ctx.domain.serializeState(problem, state)) === index)
        .slice(0, beamWidth);
      const acceptedMoves = successors
        .sort((left, right) => right.score - left.score)
        .slice(0, problem.candidateSampleSize ?? 8);
      beam = nextBeam.length > 0 ? nextBeam : beam;
      current = bestOf(problem, ctx, beam);
      if (better(ctx.domain.evaluate(problem, current).score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, best).goalReached ? 'found' : 'visiting', `Generation ${generation}: retained the top ${Math.min(beam.length, beamWidth)} successors across the whole beam.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, acceptedMoves),
        iteration: generation,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        beamWidth,
        generation,
        populationSize: beam.length,
        populationPreview: populationPreview(problem, ctx, beam),
        notes: ['The beam can converge to similar states if diversity collapses.'],
      }, ctx.domain.evaluate(problem, best).goalReached ? 'success' : 'info');
    }

    yield createStep(ctx, 'failed', `Local beam search stopped after ${maxSteps} generations.`, 6, {
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
      notes: ['Wider beams improve coverage but increase per-generation cost.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
