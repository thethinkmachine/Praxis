import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { PlanningStep } from '@/algorithms/planning/types';
import type { PlanningLabId, PlanningProblem } from '@/types/problem';
import { PLANNING_LAB_MODULES } from './lab-modules';

export interface PlanningLabDefinition {
  id: PlanningLabId;
  name: string;
  description: string;
  defaultAlgorithmId: string;
  path: string;
  createDefaultProblem: () => PlanningProblem;
  supportsAlgorithm: (algorithmId: string) => boolean;
}

export interface PlanningLabContext {
  problem: PlanningProblem;
  step: PlanningStep | null;
  currentIndex: number;
  setProblem: Dispatch<SetStateAction<PlanningProblem>>;
  updateProblem: (patch: Partial<PlanningProblem>) => void;
  resetForSetup: () => void;
  applyAction: (actionId: string) => void;
}

export interface PlanningLabModule extends PlanningLabDefinition {
  normalizeImportedProblem: (problem: unknown) => PlanningProblem;
  renderSetupSection: (context: PlanningLabContext) => ReactNode;
  renderTabs: (context: PlanningLabContext) => Array<{
    id: string;
    label: string;
    content: ReactNode;
    keepMounted?: boolean;
  }>;
}

export const PLANNING_LAB_DEFINITIONS: PlanningLabDefinition[] = PLANNING_LAB_MODULES.map((lab) => ({
  id: lab.id,
  name: lab.name,
  description: lab.description,
  defaultAlgorithmId: lab.defaultAlgorithmId,
  path: lab.path,
  createDefaultProblem: lab.createDefaultProblem,
  supportsAlgorithm: lab.supportsAlgorithm,
}));

const PLANNING_LAB_MAP = new Map(
  PLANNING_LAB_MODULES.map((lab) => [lab.id, lab]),
);

const DEFAULT_LAB_BY_ALGORITHM: Record<string, PlanningLabId> = {
  fssp: 'state-space',
  bssp: 'state-space',
  gsp: 'goal-stack',
  graphplan: 'planning-graph',
  satplan: 'planning-graph',
  pop: 'partial-order',
};

export function isPlanningLabId(id: unknown): id is PlanningLabId {
  return typeof id === 'string' && PLANNING_LAB_MAP.has(id as PlanningLabId);
}

export function getDefaultPlanningLabForAlgorithm(algorithmId: string): PlanningLabId {
  return DEFAULT_LAB_BY_ALGORITHM[algorithmId] ?? 'strips';
}

export function supportsPlanningAlgorithm(labId: PlanningLabId, algorithmId: string): boolean {
  return getPlanningLabModule(labId).supportsAlgorithm(algorithmId);
}

export function buildPlanningRoute(algorithmId: string, labId: PlanningLabId = getDefaultPlanningLabForAlgorithm(algorithmId)) {
  return `/planning/${algorithmId}?lab=${labId}`;
}

export function getPlanningLabModule(id: PlanningLabId): PlanningLabModule {
  const lab = PLANNING_LAB_MAP.get(id);
  if (!lab) {
    throw new Error(`Unknown planning lab: ${id}`);
  }
  return lab;
}

export function createDefaultPlanningProblem(labId: PlanningLabId): PlanningProblem {
  return getPlanningLabModule(labId).createDefaultProblem();
}

export function normalizePlanningProblem(problem: unknown, fallbackLab: PlanningLabId = 'state-space'): PlanningProblem {
  const incoming = problem as Partial<PlanningProblem> | null;
  const labId = incoming?.lab && isPlanningLabId(incoming.lab) ? incoming.lab : fallbackLab;
  return getPlanningLabModule(labId).normalizeImportedProblem(problem);
}
