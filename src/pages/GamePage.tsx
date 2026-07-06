import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { AlgorithmStep } from '@/types/step';
import type { GameProblem } from '@/types/problem';
import { useCurrentStep, useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import {
  buildGamePlayingRoute,
  getDefaultGamePlayingLabId,
  getGamePlayingLabModule,
  isGamePlayingLabId,
} from '@/problems/game-playing/labs';
import { renderGameLabPresetPicker, type GameLabContext } from '@/problems/game-playing/lab-modules';
import { createExecutionProblemKey } from '@/lib/execution-problem-key';

function createGameProblemKey(prefix: string): string {
  return `${prefix}:${Date.now()}`;
}

export default function GamePage() {
  const { labId, algo = 'minimax' } = useParams<{ labId: string; algo: string }>();
  const resolvedLabId = isGamePlayingLabId(labId) ? labId : getDefaultGamePlayingLabId();
  const activeLab = getGamePlayingLabModule(resolvedLabId);
  const [problem, setProblem] = useState<GameProblem>(() => activeLab.createDefaultProblem());
  const [problemKey, setProblemKey] = useState(`game:${resolvedLabId}:default`);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const step = useCurrentStep<AlgorithmStep<unknown, unknown>>(algo);
  const clearExecution = useExecutionStore((state) => state.clear);

  useEffect(() => {
    setProblem(activeLab.createDefaultProblem());
    setDemoDialogOpen(false);
    setProblemKey(`game:${activeLab.id}:default`);
  }, [activeLab]);

  const gameContext: GameLabContext = {
    algorithmId: algo,
    problem,
    setProblem,
    step,
    openDemoPicker: () => setDemoDialogOpen(true),
    markProblemChanged: (reason) => {
      clearExecution();
      setProblemKey(createGameProblemKey(`game:${activeLab.id}:${reason}`));
    },
  };
  const executionProblemKey = useMemo(
    () => `${problemKey}:${createExecutionProblemKey(problem)}`,
    [problemKey, problem],
  );
  const executionContext = useMemo(() => ({
    pageKey: 'game-playing',
    labKey: activeLab.id,
    problemKey: executionProblemKey,
    preservePosition: true,
  }), [activeLab.id, executionProblemKey]);

  if (!isGamePlayingLabId(labId)) {
    return <Navigate to={buildGamePlayingRoute(getDefaultGamePlayingLabId(), algo)} replace />;
  }

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={problem}
        problemForActions={problem}
        problemCategory="game"
        onProblemImport={(nextProblem) => {
          setProblem(activeLab.normalizeImportedProblem(nextProblem));
          clearExecution();
          setProblemKey(createGameProblemKey(`game:${activeLab.id}:import`));
        }}
        tabs={activeLab.renderTabs(gameContext)}
        titleActions={activeLab.renderTitleActions(gameContext)}
        buildAlgorithmRoute={(algorithmId) => buildGamePlayingRoute(activeLab.id, algorithmId)}
        configPanel={activeLab.renderConfigPanel(gameContext)}
        executionContext={executionContext}
        onDemoRequest={activeLab.presets.length > 0 ? () => setDemoDialogOpen(true) : undefined}
      />
      {renderGameLabPresetPicker(
        demoDialogOpen,
        setDemoDialogOpen,
        activeLab,
        (presetId) => {
          setProblem(activeLab.loadPreset(presetId));
          clearExecution();
          setProblemKey(createGameProblemKey(`game:${activeLab.id}:preset:${presetId}`));
        },
      )}
    </>
  );
}
