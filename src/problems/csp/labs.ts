import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { CspStep } from '@/algorithms/csp/types';
import type { CspLabId, CspProblem, CspPresetId } from '@/types/problem';
import { CSP_LAB_MODULES } from './lab-modules';

export interface CspLabDefinition {
  id: CspLabId;
  name: string;
  description: string;
  defaultAlgorithmId: string;
  path: string;
  createDefaultProblem: () => CspProblem;
  supportsAlgorithm: (algorithmId: string) => boolean;
}

export interface CspLabContext {
  problem: CspProblem;
  step: CspStep | null;
  currentIndex: number;
  setProblem: Dispatch<SetStateAction<CspProblem>>;
  updateProblem: (patch: Partial<CspProblem>) => void;
  resetForSetup: () => void;
}

export interface CspLabModule extends CspLabDefinition {
  normalizeImportedProblem: (problem: unknown) => CspProblem;
  renderSetupSection: (context: CspLabContext) => ReactNode;
  renderTabs: (context: CspLabContext) => Array<{
    id: string;
    label: string;
    content: ReactNode;
    keepMounted?: boolean;
  }>;
  presetIds: CspPresetId[];
}

export const CSP_LAB_DEFINITIONS: CspLabDefinition[] = CSP_LAB_MODULES.map((lab) => ({
  id: lab.id,
  name: lab.name,
  description: lab.description,
  defaultAlgorithmId: lab.defaultAlgorithmId,
  path: lab.path,
  createDefaultProblem: lab.createDefaultProblem,
  supportsAlgorithm: lab.supportsAlgorithm,
}));

const CSP_LAB_MAP = new Map(
  CSP_LAB_MODULES.map((lab) => [lab.id, lab]),
);

const DEFAULT_LAB_BY_ALGORITHM: Record<string, CspLabId> = {
  'backtracking-search': 'constraint-network',
  'forward-checking': 'constraint-network',
  'mac': 'constraint-network',
  'ac-3': 'arc-consistency',
  'gac': 'arc-consistency',
  'tree-csp': 'structure',
  'cutset-conditioning': 'structure',
};

export function isCspLabId(id: unknown): id is CspLabId {
  return typeof id === 'string' && CSP_LAB_MAP.has(id as CspLabId);
}

export function getDefaultCspLabForAlgorithm(algorithmId: string): CspLabId {
  return DEFAULT_LAB_BY_ALGORITHM[algorithmId] ?? 'constraint-network';
}

export function supportsCspAlgorithm(labId: CspLabId, algorithmId: string): boolean {
  return getCspLabModule(labId).supportsAlgorithm(algorithmId);
}

export function buildCspRoute(algorithmId: string, labId: CspLabId = getDefaultCspLabForAlgorithm(algorithmId)) {
  return `/csp/${algorithmId}?lab=${labId}`;
}

export function getCspLabModule(id: CspLabId): CspLabModule {
  const lab = CSP_LAB_MAP.get(id);
  if (!lab) {
    throw new Error(`Unknown CSP lab: ${id}`);
  }
  return lab;
}

export function createDefaultCspProblem(labId: CspLabId): CspProblem {
  return getCspLabModule(labId).createDefaultProblem();
}

export function normalizeCspProblem(problem: unknown, fallbackLab: CspLabId = 'constraint-network'): CspProblem {
  const incoming = problem as Partial<CspProblem> | null;
  const labId = incoming?.lab && isCspLabId(incoming.lab) ? incoming.lab : fallbackLab;
  return getCspLabModule(labId).normalizeImportedProblem(problem);
}
