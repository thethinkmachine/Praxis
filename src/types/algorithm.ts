export type AlgorithmCategory =
  | 'uninformed-search';

export interface AlgorithmMeta {
  id: string;
  name: string;
  shortName?: string;
  category: AlgorithmCategory;
  description: string;
  longDescription?: string;
  timeComplexity: string;
  spaceComplexity: string;
  complete: boolean | string;
  optimal: boolean | string;
  tags: string[];
  bookChapter: string;
  relatedAlgorithms?: string[];
  relationshipLabel?: string; // e.g. "extends A*", "specializes BFS"
}

export interface AlgorithmRunner<TProblem = unknown, TState = unknown, THighlight = unknown, TResult = void> {
  meta: AlgorithmMeta;
  pseudocode: string[];
  validate(problem: TProblem): { valid: boolean; errors: string[] };
  getInitialState(problem: TProblem): TState;
  run(problem: TProblem): Generator<import('./step').AlgorithmStep<TState, THighlight>, TResult, void>;
}
