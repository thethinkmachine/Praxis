import { useCallback } from 'react';
import { useExecutionStore } from '@/store/execution.store';

export function useExportTrace() {
  const engine = useExecutionStore(state => state.engine);
  const algorithmId = useExecutionStore(state => state.algorithmId);
  const problemSnapshot = useExecutionStore(state => state.problemSnapshot);

  const exportJSON = useCallback(() => {
    if (!engine) return;
    const steps = engine.getAllSteps();
    const data = {
      algorithmId,
      problem: problemSnapshot,
      totalSteps: steps.length,
      finalMetrics: engine.getFinalMetrics(),
      steps: steps.map(s => ({
        stepNumber: s.stepNumber,
        phase: s.phase,
        description: s.description,
        pseudocodeLine: s.pseudocodeLine,
        metrics: s.metrics,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praxis-trace-${algorithmId ?? 'algorithm'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [engine, algorithmId, problemSnapshot]);

  const exportCSV = useCallback(() => {
    if (!engine) return;
    const steps = engine.getAllSteps();
    const headers = ['step', 'phase', 'description', 'pseudocodeLine', 'nodesExpanded', 'frontierSize', 'depth', 'pathCost', 'memoryUsed', 'elapsedMs'];
    const rows = steps.map(s => [
      s.stepNumber,
      s.phase,
      `"${s.description.replace(/"/g, '""')}"`,
      s.pseudocodeLine,
      s.metrics.nodesExpanded,
      s.metrics.frontierSize,
      s.metrics.currentDepth,
      s.metrics.pathCost,
      s.metrics.memoryUsed,
      s.metrics.elapsedMs?.toFixed(2) ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praxis-trace-${algorithmId ?? 'algorithm'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [engine, algorithmId]);

  return { exportJSON, exportCSV, hasTrace: !!engine };
}
