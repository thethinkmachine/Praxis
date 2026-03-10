import { DEFAULT_COOLING_RATE, DEFAULT_INITIAL_TEMPERATURE, DEFAULT_MAX_STEPS, better } from './core';
import { buildResult, createContext, createStep, describeEvaluation, getInitialState, sampleCandidates } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const simulatedAnnealingRunner: LocalSearchRunner = {
  meta: {
    id: 'simulated-annealing',
    name: 'Simulated Annealing',
    shortName: 'Annealing',
    category: 'local-search',
    description: 'Accepts worse moves with a temperature-controlled probability so the search can escape local optima.',
    longDescription: 'Simulated annealing is the canonical escape mechanism for local search. Early in the run it behaves like a noisy random walk; as the temperature cools, it becomes increasingly greedy.',
    timeComplexity: 'O(k)',
    spaceComplexity: 'O(1)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'stochastic', 'annealing'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['random-walk', 'hill-climbing-stochastic'],
  },
  pseudocode: [
    'function SIMULATED-ANNEALING(problem, schedule):',
    '  current <- INITIAL-STATE(problem)',
    '  best <- current',
    '  for t in 1..maxSteps:',
    '    T <- schedule(t)',
    '    next <- RANDOM-NEIGHBOR(current)',
    '    if score(next) > score(current): current <- next',
    '    else if random() < exp((score(next)-score(current))/T): current <- next',
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
    const initialTemperature = problem.initialTemperature ?? DEFAULT_INITIAL_TEMPERATURE;
    const coolingRate = problem.coolingRate ?? DEFAULT_COOLING_RATE;
    let current = ctx.domain.normalizeState(problem, ctx.random);
    let best = current;

    yield createStep(ctx, 'initializing', describeEvaluation('Initialized simulated annealing on', ctx, problem, current), 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      temperature: initialTemperature,
      notes: ['Temperature starts high so some worse moves are still acceptable early in the run.'],
    });

    for (let iteration = 1; iteration <= maxSteps; iteration++) {
      const temperature = initialTemperature * Math.pow(coolingRate, iteration - 1);
      const neighbors = ctx.domain.getNeighbors(problem, current, ctx.random);
      const accepted = ctx.domain.getRandomNeighbor?.(problem, current, ctx.random) ?? neighbors[Math.floor(ctx.random() * Math.max(neighbors.length, 1))] ?? null;
      ctx.neighborsEvaluated += neighbors.length;
      if (!accepted) break;

      const currentScore = ctx.domain.evaluate(problem, current).score;
      const delta = accepted.score - currentScore;
      const acceptanceProbability = delta >= 0 || temperature <= 1e-6 ? (delta >= 0 ? 1 : 0) : Math.exp(delta / temperature);
      const acceptedMove = delta >= 0 || ctx.random() < acceptanceProbability;

      yield createStep(ctx, 'expanding', `Iteration ${iteration}: sampled one neighbor and evaluated whether temperature ${temperature.toFixed(3)} is high enough to accept it.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: acceptedMove ? accepted : null,
        rejectedMove: acceptedMove ? null : accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: iteration - 1,
        temperature,
        notes: [delta >= 0
          ? 'Improving moves are always accepted.'
          : `Worse move acceptance probability: ${acceptanceProbability.toFixed(3)}.`],
      });

      if (acceptedMove) {
        current = accepted.state;
        if (better(ctx.domain.evaluate(problem, current).score, ctx.domain.evaluate(problem, best).score)) best = current;
      }

      yield createStep(ctx, ctx.domain.evaluate(problem, current).goalReached ? 'found' : 'visiting', acceptedMove
        ? `Accepted ${accepted.label}${delta < 0 ? ' even though it was worse, because the temperature still allowed exploration.' : '.'}`
        : `Rejected ${accepted.label}; the temperature was too low for that downhill move.`, 6, {
        problem,
        currentState: current,
        bestState: best,
        candidateMoves: sampleCandidates(problem, neighbors),
        acceptedMove: acceptedMove ? accepted : null,
        rejectedMove: acceptedMove ? null : accepted,
        iteration,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: acceptedMove ? 0 : iteration,
        temperature,
        notes: ['As cooling continues, the algorithm behaves more like hill climbing.'],
      }, ctx.domain.evaluate(problem, current).goalReached ? 'success' : 'info');

      if (ctx.domain.evaluate(problem, current).goalReached) {
        return buildResult(ctx, problem, best);
      }
    }

    yield createStep(ctx, 'failed', `Annealing stopped after ${maxSteps} iterations with best ${ctx.domain.objectiveLabel.toLowerCase()} ${ctx.domain.evaluate(problem, best).displayValue}.`, 8, {
      problem,
      currentState: current,
      bestState: best,
      iteration: maxSteps,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: maxSteps,
      temperature: initialTemperature * Math.pow(coolingRate, maxSteps - 1),
      notes: ['Cooling schedules strongly affect whether the run explores enough before freezing.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
