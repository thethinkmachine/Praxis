import { useCallback } from 'react';
import { setMapReplacer, setMapReviver } from '@/lib/serialization';

/**
 * Hook for importing and exporting problem definitions as JSON files.
 * Works with any algorithm category's problem structure.
 */
export function useProblemImportExport(
    currentProblem: unknown,
    algorithmId: string,
    onImport: (problem: unknown) => void,
    onError?: (message: string) => void,
) {
    const exportProblem = useCallback(() => {
        const data = {
            _praxisProblemExport: true,
            version: 1,
            algorithmId,
            exportedAt: new Date().toISOString(),
            problem: currentProblem,
        };

        const json = JSON.stringify(data, setMapReplacer, 2);

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `praxis-problem-${algorithmId}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [currentProblem, algorithmId]);

    const importProblem = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text, setMapReviver);

                if (data._praxisProblemExport && data.problem) {
                    onImport(data.problem);
                } else if (data.problem) {
                    // Legacy: accept any JSON with a `problem` key
                    onImport(data.problem);
                } else {
                    // Treat the entire JSON as the problem
                    onImport(data);
                }
            } catch (err) {
                console.error('Failed to import problem:', err);
                onError?.('Failed to import problem file. Please check the file format.');
            }
        };
        input.click();
    }, [onImport, onError]);

    return { exportProblem, importProblem };
}
