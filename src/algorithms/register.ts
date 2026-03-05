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

export function registerAllAlgorithms() {
  // Uninformed Search
  registry.register(bfsRunner);
  registry.register(dfsRunner);
  registry.register(dlsRunner);
  registry.register(iddfsRunner);
  registry.register(ucsRunner);
  registry.register(bidirectionalBfsRunner);
}
