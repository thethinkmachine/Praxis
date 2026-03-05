import { useCallback } from 'react';
import type { AlgorithmRunner } from '@/types';
import { useExecutionStore } from '@/store/execution.store';

export function useAlgorithm() {
  const loadAlgorithm = useExecutionStore(s => s.loadAlgorithm);
  const stepForwardAction = useExecutionStore(s => s.stepForward);

  const load = useCallback((runner: AlgorithmRunner, problem: unknown, algorithmId?: string) => {
    loadAlgorithm(runner, problem, algorithmId);
    stepForwardAction(); // Jump to first step after loading
  }, [loadAlgorithm, stepForwardAction]);

  return {
    load,
    stepForward: useExecutionStore(s => s.stepForward),
    stepBackward: useExecutionStore(s => s.stepBackward),
    seekToStep: useExecutionStore(s => s.seekToStep),
    jumpToStart: useExecutionStore(s => s.jumpToStart),
    jumpToEnd: useExecutionStore(s => s.jumpToEnd),
    play: useExecutionStore(s => s.play),
    pause: useExecutionStore(s => s.pause),
    reset: useExecutionStore(s => s.reset),
    setSpeed: useExecutionStore(s => s.setSpeed),
    currentStep: useExecutionStore(s => s.currentStep),
    currentIndex: useExecutionStore(s => s.currentIndex),
    totalSteps: useExecutionStore(s => s.totalSteps),
    isPlaying: useExecutionStore(s => s.isPlaying),
    speed: useExecutionStore(s => s.speed),
    truncated: useExecutionStore(s => s.truncated),
    engine: useExecutionStore(s => s.engine),
  };
}
