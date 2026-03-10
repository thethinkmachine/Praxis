/**
 * Algorithm Registration
 * Import all algorithm runners and register them in the AlgorithmRegistry.
 * This file must be imported once at app startup (e.g., in main.tsx or App.tsx).
 */
import { registry } from './core/registry';

// Uninformed Search
import { bfsRunner } from './search/uninformed/bfs';
import { dfsRunner } from './search/uninformed/dfs';
import { dlsRunner } from './search/uninformed/dls';
import { iddfsRunner } from './search/uninformed/iddfs';
import { ucsRunner } from './search/uninformed/ucs';
import { bidirectionalBfsRunner } from './search/uninformed/bidirectional-bfs';
import { bidirectionalUcsRunner } from './search/uninformed/bidirectional-ucs';

// Informed Search
import { greedyBfsRunner } from './search/informed/greedy-bfs';
import { astarRunner } from './search/informed/astar';
import { weightedAstarRunner } from './search/informed/weighted-astar';
import { idaStarRunner } from './search/informed/ida-star';
import { rbfsRunner } from './search/informed/rbfs';
import { smaStarRunner } from './search/informed/sma-star';
import { bidirectionalAstarRunner } from './search/informed/bidirectional-astar';
import { minimaxRunner } from './game-playing/minimax';
import { alphaBetaRunner } from './game-playing/alpha-beta';
import { negamaxRunner } from './game-playing/negamax';
import { hillClimbingSteepestRunner } from './local-search/hill-climbing-steepest';
import { hillClimbingSimpleRunner } from './local-search/hill-climbing-simple';
import { hillClimbingFirstChoiceRunner } from './local-search/hill-climbing-first-choice';
import { hillClimbingStochasticRunner } from './local-search/hill-climbing-stochastic';
import { hillClimbingSidewaysRunner } from './local-search/hill-climbing-sideways';
import { hillClimbingRandomRestartRunner } from './local-search/hill-climbing-random-restart';
import { randomWalkRunner } from './local-search/random-walk';
import { simulatedAnnealingRunner } from './local-search/simulated-annealing';
import { localBeamSearchRunner } from './local-search/local-beam-search';
import { stochasticBeamSearchRunner } from './local-search/stochastic-beam-search';
import { tabuSearchRunner } from './local-search/tabu-search';
import { geneticAlgorithmRunner } from './local-search/genetic-algorithm';
import { minConflictsRunner } from './local-search/min-conflicts';

export function registerAllAlgorithms() {
  // Uninformed Search
  registry.register(bfsRunner);
  registry.register(dfsRunner);
  registry.register(dlsRunner);
  registry.register(iddfsRunner);
  registry.register(ucsRunner);
  registry.register(bidirectionalBfsRunner);
  registry.register(bidirectionalUcsRunner);

  // Informed Search
  registry.register(greedyBfsRunner);
  registry.register(astarRunner);
  registry.register(rbfsRunner);
  registry.register(smaStarRunner);
  registry.register(bidirectionalAstarRunner);
  registry.register(weightedAstarRunner);
  registry.register(idaStarRunner);

  // Game Playing
  registry.register(minimaxRunner);
  registry.register(alphaBetaRunner);
  registry.register(negamaxRunner);

  // Local Search
  registry.register(randomWalkRunner);
  registry.register(hillClimbingSimpleRunner);
  registry.register(hillClimbingSteepestRunner);
  registry.register(hillClimbingFirstChoiceRunner);
  registry.register(hillClimbingStochasticRunner);
  registry.register(hillClimbingSidewaysRunner);
  registry.register(hillClimbingRandomRestartRunner);
  registry.register(simulatedAnnealingRunner);
  registry.register(localBeamSearchRunner);
  registry.register(stochasticBeamSearchRunner);
  registry.register(tabuSearchRunner);
  registry.register(geneticAlgorithmRunner);
  registry.register(minConflictsRunner);
}
