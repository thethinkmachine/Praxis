import {
  DEFAULT_CROSSOVER_RATE,
  DEFAULT_MAX_STEPS,
  DEFAULT_MUTATION_RATE,
  DEFAULT_POPULATION,
  better,
  sortByScoreDescending,
  tournamentSelect,
} from './core';
import { bestOf, buildResult, createContext, createStep, getInitialState, populationPreview } from './shared';
import type { LocalSearchRunner } from './types';
import type { LocalSearchProblem } from '@/types/problem';
import { getLocalSearchDomain } from '@/problems/local-search/domains';

export const geneticAlgorithmRunner: LocalSearchRunner = {
  meta: {
    id: 'genetic-algorithm',
    name: 'Genetic Algorithm',
    shortName: 'Genetic',
    category: 'local-search',
    description: 'Maintains a population of states and evolves it through selection, crossover, mutation, and survival.',
    longDescription: 'Genetic algorithms shift from single-state local search to population-based search. They are useful for showing how recombination, mutation, and selection pressure trade off exploration against convergence.',
    timeComplexity: 'O(g · p · b)',
    spaceComplexity: 'O(p)',
    complete: false,
    optimal: false,
    tags: ['local-search', 'population', 'genetic'],
    bookChapter: 'AIMA 4th Ed. § 4.1',
    relatedAlgorithms: ['stochastic-beam-search', 'local-beam-search'],
  },
  pseudocode: [
    'function GENETIC-ALGORITHM(problem, populationSize):',
    '  population <- random states',
    '  best <- best-of(population)',
    '  loop:',
    '    parents <- select(population)',
    '    child <- crossover(parents)',
    '    child <- maybe-mutate(child)',
    '    population <- survivors(population, children)',
    '    if best-of(population) improves best: best <- best-of(population)',
  ],
  validate(problem: LocalSearchProblem) {
    const domain = getLocalSearchDomain(problem);
    const base = domain.validate(problem);
    if (!base.valid) return base;
    if (!domain.crossover || !domain.mutate) {
      return {
        valid: false,
        errors: [`${domain.label} does not define both crossover and mutation operators.`],
      };
    }
    return base;
  },
  getInitialState,
  *run(problem: LocalSearchProblem) {
    const ctx = createContext(problem);
    const generations = problem.maxSteps ?? DEFAULT_MAX_STEPS;
    const populationSize = problem.populationSize ?? DEFAULT_POPULATION;
    const mutationRate = problem.mutationRate ?? DEFAULT_MUTATION_RATE;
    const crossoverRate = problem.crossoverRate ?? DEFAULT_CROSSOVER_RATE;
    const crossover = ctx.domain.crossover!;
    const mutate = ctx.domain.mutate!;
    let population = Array.from({ length: populationSize }, () => ctx.domain.createRandomState(problem, ctx.random));
    let best = bestOf(problem, ctx, population);
    let current = best;

    yield createStep(ctx, 'initializing', `Initialized genetic algorithm with population size ${populationSize}.`, 1, {
      problem,
      currentState: current,
      bestState: best,
      iteration: 0,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: 0,
      generation: 0,
      populationSize: population.length,
      populationPreview: populationPreview(problem, ctx, population),
      notes: ['Selection, crossover, and mutation are now the main drivers of search.'],
    });

    for (let generation = 1; generation <= generations; generation++) {
      if (ctx.domain.evaluate(problem, best).goalReached) {
        return buildResult(ctx, problem, best);
      }

      const nextPopulation: unknown[] = [best];
      while (nextPopulation.length < populationSize) {
        const left = tournamentSelect(problem, ctx, population, ctx.random);
        const right = tournamentSelect(problem, ctx, population, ctx.random);
        let child = ctx.random() < crossoverRate ? crossover(problem, left, right, ctx.random) : left;
        if (ctx.random() < mutationRate) child = mutate(problem, child, ctx.random);
        nextPopulation.push(child);
      }
      population = sortByScoreDescending(problem, ctx, nextPopulation).slice(0, populationSize);
      current = bestOf(problem, ctx, population);
      if (better(ctx.domain.evaluate(problem, current).score, ctx.domain.evaluate(problem, best).score)) best = current;

      yield createStep(ctx, ctx.domain.evaluate(problem, best).goalReached ? 'found' : 'visiting', `Generation ${generation}: bred a new population through selection, crossover, and mutation.`, 4, {
        problem,
        currentState: current,
        bestState: best,
        iteration: generation,
        restartCount: 0,
        plateauLength: 0,
        stagnationSteps: 0,
        generation,
        populationSize: population.length,
        populationPreview: populationPreview(problem, ctx, population),
        notes: [
          `crossover rate ${crossoverRate.toFixed(2)}`,
          `mutation rate ${mutationRate.toFixed(2)}`,
        ],
      }, ctx.domain.evaluate(problem, best).goalReached ? 'success' : 'info');
    }

    yield createStep(ctx, 'failed', `Genetic algorithm stopped after ${generations} generations.`, 7, {
      problem,
      currentState: current,
      bestState: best,
      iteration: generations,
      restartCount: 0,
      plateauLength: 0,
      stagnationSteps: generations,
      generation: generations,
      populationSize: population.length,
      populationPreview: populationPreview(problem, ctx, population),
      notes: ['Population diversity and operator quality dominate GA performance.'],
    }, 'warn');
    return buildResult(ctx, problem, best);
  },
};
