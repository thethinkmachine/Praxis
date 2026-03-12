import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import type { GraphColoringProblem, LandscapeProblem, LocalSearchProblem, NPuzzleProblem, NQueensProblem, TspProblem } from '@/types/problem';
import {
  LOCAL_SEARCH_LAB_MODULES,
} from './lab-modules';

export interface LocalSearchLabDefinition<TProblem extends LocalSearchProblem = LocalSearchProblem> {
  id: TProblem['kind'];
  name: string;
  description: string;
  defaultAlgorithmId: string;
  path: string;
  createDefaultProblem: () => TProblem;
}

export interface LocalSearchLabContext {
  problem: LocalSearchProblem;
  step: LocalSearchStep | null;
  currentIndex: number;
  setProblem: Dispatch<SetStateAction<LocalSearchProblem>>;
  updateProblem: (patch: Record<string, unknown>) => void;
  resetForSetup: () => void;
}

export interface LocalSearchLabModule extends LocalSearchLabDefinition {
  normalizeImportedProblem: (problem: unknown) => LocalSearchProblem;
  randomizeProblem: (problem: LocalSearchProblem) => LocalSearchProblem;
  renderSetupSection: (context: LocalSearchLabContext) => ReactNode;
  renderBoardTab: (context: LocalSearchLabContext) => ReactNode;
  renderNeighborhoodTab: (context: LocalSearchLabContext) => ReactNode;
}

export const LOCAL_SEARCH_LAB_DEFINITIONS: LocalSearchLabDefinition[] = LOCAL_SEARCH_LAB_MODULES.map((module) => ({
  id: module.id,
  name: module.name,
  description: module.description,
  defaultAlgorithmId: module.defaultAlgorithmId,
  path: module.path,
  createDefaultProblem: module.createDefaultProblem,
}));

const LOCAL_SEARCH_LAB_MAP = new Map(
  LOCAL_SEARCH_LAB_MODULES.map((lab) => [lab.id, lab]),
);

export function isLocalSearchLabKind(kind: unknown): kind is LocalSearchProblem['kind'] {
  return typeof kind === 'string' && LOCAL_SEARCH_LAB_MAP.has(kind as LocalSearchProblem['kind']);
}

export function getLocalSearchLabDefinition<TProblem extends LocalSearchProblem = LocalSearchProblem>(
  kind: TProblem['kind'],
): LocalSearchLabDefinition<TProblem> {
  const lab = LOCAL_SEARCH_LAB_MAP.get(kind);
  if (!lab) {
    throw new Error(`Unknown local-search lab: ${kind}`);
  }
  return lab as unknown as LocalSearchLabDefinition<TProblem>;
}

export function getLocalSearchLabModule(kind: LocalSearchProblem['kind']): LocalSearchLabModule {
  const lab = LOCAL_SEARCH_LAB_MAP.get(kind);
  if (!lab) {
    throw new Error(`Unknown local-search lab: ${kind}`);
  }
  return lab;
}

export function createDefaultLocalSearchProblem(kind: NQueensProblem['kind']): NQueensProblem;
export function createDefaultLocalSearchProblem(kind: TspProblem['kind']): TspProblem;
export function createDefaultLocalSearchProblem(kind: GraphColoringProblem['kind']): GraphColoringProblem;
export function createDefaultLocalSearchProblem(kind: LandscapeProblem['kind']): LandscapeProblem;
export function createDefaultLocalSearchProblem(kind: NPuzzleProblem['kind']): NPuzzleProblem;
export function createDefaultLocalSearchProblem(kind: LocalSearchProblem['kind']): LocalSearchProblem;
export function createDefaultLocalSearchProblem(kind: LocalSearchProblem['kind']): LocalSearchProblem {
  return getLocalSearchLabModule(kind).createDefaultProblem();
}

export function normalizeLocalSearchProblem(
  problem: unknown,
  fallbackKind: LocalSearchProblem['kind'] = 'n-queens',
): LocalSearchProblem {
  const incoming = problem as Partial<LocalSearchProblem> | null;
  if (incoming && isLocalSearchLabKind(incoming.kind)) {
    return getLocalSearchLabModule(incoming.kind).normalizeImportedProblem(problem);
  }
  return createDefaultLocalSearchProblem(fallbackKind);
}

export function randomizeLocalSearchProblem(problem: LocalSearchProblem): LocalSearchProblem {
  return getLocalSearchLabModule(problem.kind).randomizeProblem(problem);
}