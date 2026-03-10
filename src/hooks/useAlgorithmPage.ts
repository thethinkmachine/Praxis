import { useMemo, useEffect } from 'react';
import { registry } from '@/algorithms/core/registry';
import { useExecutionStore } from '@/store/execution.store';
import { usePlayback } from '@/hooks/usePlayback';
import type { AlgorithmRunner, AlgorithmStep } from '@/types';

function isEmptyGraphProblem(problem: unknown): boolean {
  if (!problem || typeof problem !== 'object') return false;
  const graph = (problem as { graph?: { nodes?: unknown[] } }).graph;
  return Array.isArray(graph?.nodes) && graph.nodes.length === 0;
}

/**
 * Shared hook for all algorithm pages.
 * Handles runner lookup, execution store integration, playback setup,
 * and algorithm loading when id/problem changes.
 */
export function useAlgorithmPage(algorithmId: string, problem: unknown) {
  const loadAlgorithm = useExecutionStore(state => state.loadAlgorithm);
  const clear = useExecutionStore(state => state.clear);
  const stepForward = useExecutionStore(state => state.stepForward);
  
  usePlayback();

  const runner = useMemo(() => {
    const entry = registry.get(algorithmId);
    return (entry?.runner as AlgorithmRunner) ?? null;
  }, [algorithmId]);

  useEffect(() => {
    if (!runner) return;
    if (isEmptyGraphProblem(problem)) {
      clear();
      return;
    }
    loadAlgorithm(runner, problem, algorithmId);
    
    // Only jump to first step if we aren't preserving a previous index
    if (useExecutionStore.getState().currentIndex === -1) {
      stepForward();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithmId, problem, runner]);

  const step = useExecutionStore(state => state.currentStep as AlgorithmStep | null);
  const loadError = useExecutionStore(state => state.loadError);
  const loadWarning = useExecutionStore(state => state.loadWarning);

  return { runner, step, loadError, loadWarning };
}
