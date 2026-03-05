import type { AlgorithmStep } from '@/types/step';
import type { SearchHighlight } from '../uninformed/types';

export interface InformedSearchState {
  frontier: string[];
  explored: Set<string>;
  pathMap: Map<string, string | null>;
  foundPath: string[] | null;
  gCosts: Map<string, number>;
  hCosts: Map<string, number>;
  fCosts: Map<string, number>;
}

export type InformedSearchStep = AlgorithmStep<InformedSearchState, SearchHighlight>;

// Re-export shared helpers so informed runners only need one import
export {
  reconstructPath,
  validateGraphProblem,
  buildAdjacencyList,
} from '../uninformed/types';

export {
  INFORMED_HEURISTICS,
  getHeuristicDefinition,
  createHeuristicEvaluator,
  getHeuristicValidationWarnings,
} from './heuristics';

export type { SearchHighlight };
