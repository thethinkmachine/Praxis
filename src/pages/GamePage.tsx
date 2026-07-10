import { useEffect, useMemo, useRef, useState } from 'react';
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
  const currentIndex = useExecutionStore((state) => state.currentIndex);
  const clearExecution = useExecutionStore((state) => state.clear);

  // Reset to the lab's default problem only when the user actually switches to
  // a *different* lab — never on the initial mount. The useState initializer
  // above already seeded `problem`, and a lab's own tab (e.g. the custom-tree
  // shared-link loader) runs its mount effect *before* this parent effect and
  // may have loaded a `?t=` tree; a blind reset here would stomp it.
  //
  // This is a value-based guard (compare the previous lab id), NOT a
  // first-mount flag: under React.StrictMode effects run setup→cleanup→setup,
  // so a boolean "skip once" flag gets flipped on the throwaway pass and the
  // real reset fires anyway. Comparing ids is immune to that double-invoke.
  const prevLabIdRef = useRef(activeLab.id);
  useEffect(() => {
    if (prevLabIdRef.current === activeLab.id) return;
    prevLabIdRef.current = activeLab.id;
    setProblem(activeLab.createDefaultProblem());
    setDemoDialogOpen(false);
    setProblemKey(`game:${activeLab.id}:default`);
  }, [activeLab]);

  const gameContext: GameLabContext = {
    algorithmId: algo,
    problem,
    setProblem,
    step,
    currentIndex,
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
