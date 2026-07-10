import type { ReactNode } from 'react';
import type { GameProblem } from '@/types/problem';
import {
  GAME_PLAYING_LAB_MODULES,
  type GameLabContext,
  type GameLabPresetDefinition,
} from './lab-modules';

export type GamePlayingLabId = 'custom-tree';

export interface GamePlayingLabDefinition<TProblem = unknown> {
  id: GamePlayingLabId;
  name: string;
  description: string;
  category: 'game-playing';
  status: 'live' | 'coming-soon';
  defaultAlgorithmId: string;
  path: string;
  createDefaultProblem: () => TProblem;
}

export interface GamePlayingRenderableLab extends GamePlayingLabDefinition<GameProblem> {
  normalizeImportedProblem: (problem: unknown) => GameProblem;
  presets: GameLabPresetDefinition[];
  loadPreset: (presetId: string) => GameProblem;
  renderConfigPanel: (context: GameLabContext) => ReactNode;
  renderTabs: (context: GameLabContext) => Array<{
    id: string;
    label: string;
    content: ReactNode;
    keepMounted?: boolean;
  }>;
  renderTitleActions: (context: GameLabContext) => ReactNode;
}

export const GAME_PLAYING_LAB_DEFINITIONS: GamePlayingLabDefinition[] = GAME_PLAYING_LAB_MODULES.map((lab) => ({
  id: lab.id as GamePlayingLabId,
  name: lab.name,
  description: lab.description,
  category: lab.category,
  status: lab.status,
  defaultAlgorithmId: lab.defaultAlgorithmId,
  path: lab.path,
  createDefaultProblem: lab.createDefaultProblem,
}));

const GAME_PLAYING_LAB_MAP = new Map(
  GAME_PLAYING_LAB_MODULES.map((lab) => [lab.id, lab]),
);

export function isGamePlayingLabId(id: unknown): id is GamePlayingLabId {
  return typeof id === 'string' && GAME_PLAYING_LAB_MAP.has(id);
}

export function getDefaultGamePlayingLabId(): GamePlayingLabId {
  return GAME_PLAYING_LAB_DEFINITIONS[0]?.id ?? 'custom-tree';
}

export function buildGamePlayingRoute(labId: GamePlayingLabId, algorithmId: string): string {
  return `/play/${labId}/${algorithmId}`;
}

export function getGamePlayingLabDefinition(id: GamePlayingLabId): GamePlayingLabDefinition {
  const lab = GAME_PLAYING_LAB_MAP.get(id);
  if (!lab) {
    throw new Error(`Unknown game-playing lab: ${id}`);
  }
  return {
    id: lab.id as GamePlayingLabId,
    name: lab.name,
    description: lab.description,
    category: lab.category,
    status: lab.status,
    defaultAlgorithmId: lab.defaultAlgorithmId,
    path: lab.path,
    createDefaultProblem: lab.createDefaultProblem,
  };
}

export function getGamePlayingLabModule(id: GamePlayingLabId): GamePlayingRenderableLab {
  const lab = GAME_PLAYING_LAB_MAP.get(id);
  if (!lab) {
    throw new Error(`Unknown game-playing lab: ${id}`);
  }
  return lab as GamePlayingRenderableLab;
}