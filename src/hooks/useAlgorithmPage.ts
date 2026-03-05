import { useMemo, useEffect } from 'react';
import { registry } from '@/algorithms/core/registry';
import { useExecutionStore } from '@/store/execution.store';
import { usePlayback } from '@/hooks/usePlayback';
import type { AlgorithmRunner, AlgorithmStep } from '@/types';

/**
 * Shared hook for all algorithm pages.
 * Handles runner lookup, execution store integration, playback setup,
 * and algorithm loading when id/problem changes.
 */
export function useAlgorithmPage(algorithmId: string, problem: unknown) {
  const store = useExecutionStore();
  usePlayback();

  const runner = useMemo(() => {
    const entry = registry.get(algorithmId);
    return (entry?.runner as AlgorithmRunner) ?? null;
  }, [algorithmId]);

  useEffect(() => {
    if (!runner) return;
    store.loadAlgorithm(runner, problem, algorithmId);
    store.stepForward();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithmId, problem]);

  const step = store.currentStep as AlgorithmStep | null;
  const loadError = store.loadError;
  const loadWarning = store.loadWarning;

  return { runner, step, loadError, loadWarning, store };
}
