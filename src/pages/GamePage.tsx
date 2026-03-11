import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { AlgorithmStep } from '@/types/step';
import type { GameProblem } from '@/types/problem';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import {
  buildGamePlayingRoute,
  getDefaultGamePlayingLabId,
  getGamePlayingLabModule,
  isGamePlayingLabId,
} from '@/problems/game-playing/labs';
import { renderGameLabPresetPicker, type GameLabContext } from '@/problems/game-playing/lab-modules';

export default function GamePage() {
  const { labId, algo = 'minimax' } = useParams<{ labId: string; algo: string }>();
  const resolvedLabId = isGamePlayingLabId(labId) ? labId : getDefaultGamePlayingLabId();
  const activeLab = getGamePlayingLabModule(resolvedLabId);
  const [problem, setProblem] = useState<GameProblem>(() => activeLab.createDefaultProblem());
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const step = useExecutionStore(state => state.currentStep as AlgorithmStep<unknown, unknown> | null);

  useEffect(() => {
    setProblem(activeLab.createDefaultProblem());
    setDemoDialogOpen(false);
  }, [activeLab]);

  const gameContext: GameLabContext = {
    algorithmId: algo,
    problem,
    setProblem,
    step,
    openDemoPicker: () => setDemoDialogOpen(true),
  };

  if (!isGamePlayingLabId(labId)) {
    return <Navigate to={buildGamePlayingRoute(getDefaultGamePlayingLabId(), algo)} replace />;
  }

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={problem}
        problemForActions={problem}
        category="game-playing"
        problemCategory="game"
        onProblemImport={(nextProblem) => setProblem(activeLab.normalizeImportedProblem(nextProblem))}
        tabs={activeLab.renderTabs(gameContext)}
        titleActions={activeLab.renderTitleActions(gameContext)}
        buildAlgorithmRoute={(algorithmId) => buildGamePlayingRoute(activeLab.id, algorithmId)}
        configPanel={activeLab.renderConfigPanel(gameContext)}
        defaultConfigOpen
        onDemoRequest={activeLab.presets.length > 0 ? () => setDemoDialogOpen(true) : undefined}
      />
      {renderGameLabPresetPicker(
        demoDialogOpen,
        setDemoDialogOpen,
        activeLab,
        (presetId) => setProblem(activeLab.loadPreset(presetId)),
      )}
    </>
  );
}
