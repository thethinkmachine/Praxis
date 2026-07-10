import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { AlgorithmStep } from '@/types/step';
import type { GameProblem } from '@/types/problem';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import {
  CUSTOM_TREE_SCENARIOS,
  createDefaultGameTreeProblem,
  getCustomTreeScenario,
  normalizeGameTreeProblem,
} from './custom-tree-lab';
import {
  renderCustomTreeConfigPanel,
  renderCustomTreeTabs,
  renderCustomTreeTitleActions,
} from './custom-tree-lab-module';

export interface GameLabPresetDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface GameLabContext {
  algorithmId: string;
  problem: GameProblem;
  setProblem: Dispatch<SetStateAction<GameProblem>>;
  step: AlgorithmStep<unknown, unknown> | null;
  currentIndex: number;
  openDemoPicker: () => void;
  markProblemChanged: (reason: string) => void;
}

export interface GamePlayingLabModule {
  id: string;
  name: string;
  description: string;
  category: 'game-playing';
  status: 'live' | 'coming-soon';
  defaultAlgorithmId: string;
  path: string;
  createDefaultProblem: () => GameProblem;
  normalizeImportedProblem: (problem: unknown) => GameProblem;
  presets: GameLabPresetDefinition[];
  loadPreset: (presetId: string) => GameProblem;
  renderConfigPanel: (context: GameLabContext) => ReactNode;
  renderTabs: (context: GameLabContext) => TabDefinition[];
  renderTitleActions: (context: GameLabContext) => ReactNode;
}

export const GAME_PLAYING_LAB_MODULES: GamePlayingLabModule[] = [
  {
    id: 'custom-tree',
    name: 'Custom Tree',
    description: 'Draw your own MAX/MIN/chance game tree and watch Minimax, Alpha-Beta, Negamax, SSS*, Expectimax, and MCTS work on it.',
    category: 'game-playing',
    status: 'live',
    defaultAlgorithmId: 'minimax',
    path: '/play/custom-tree/minimax',
    createDefaultProblem: createDefaultGameTreeProblem,
    normalizeImportedProblem: normalizeGameTreeProblem,
    presets: CUSTOM_TREE_SCENARIOS.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      tags: scenario.tags,
    })),
    loadPreset(presetId: string) {
      return getCustomTreeScenario(presetId as Parameters<typeof getCustomTreeScenario>[0]);
    },
    renderConfigPanel: renderCustomTreeConfigPanel,
    renderTabs: renderCustomTreeTabs,
    renderTitleActions: renderCustomTreeTitleActions,
  },
];

export function renderGameLabPresetPicker(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  lab: GamePlayingLabModule,
  onSelect: (presetId: string) => void,
) {
  return (
    <PresetPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Choose a ${lab.name} Demo`}
      subtitle={`Load a preset scenario for ${lab.name.toLowerCase()}`}
      items={lab.presets}
      onSelect={onSelect}
    />
  );
}
