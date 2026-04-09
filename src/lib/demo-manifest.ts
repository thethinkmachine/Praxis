import type { AlgorithmCategory } from '@/types';

export interface DemoProblemDefinition {
  id: string;
  name: string;
  description: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedSteps: number;
  tags?: string[];
}

export interface DemoManifest {
  version: number;
  'uninformed-search'?: DemoProblemDefinition[];
  'informed-search'?: DemoProblemDefinition[];
  'game-playing'?: DemoProblemDefinition[];
  'local-search'?: DemoProblemDefinition[];
}

const ALGORITHM_CATEGORIES: AlgorithmCategory[] = [
  'uninformed-search',
  'informed-search',
  'game-playing',
  'local-search',
];

function isDifficulty(value: unknown): value is DemoProblemDefinition['difficulty'] {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isDemoProblemDefinition(value: unknown): value is DemoProblemDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as DemoProblemDefinition;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.hint === 'string' &&
    typeof candidate.estimatedSteps === 'number' &&
    isDifficulty(candidate.difficulty) &&
    (candidate.tags === undefined || Array.isArray(candidate.tags))
  );
}

export function isDemoManifest(value: unknown): value is DemoManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as DemoManifest;

  if (typeof manifest.version !== 'number') {
    return false;
  }

  return ALGORITHM_CATEGORIES.every((category) => {
    const entries = manifest[category];
    return entries === undefined || (Array.isArray(entries) && entries.every(isDemoProblemDefinition));
  });
}
