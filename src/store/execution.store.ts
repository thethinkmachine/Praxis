import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AlgorithmStep, AlgorithmRunner, LogEntry } from '@/types';
import { ExecutionEngine } from '@/algorithms/core/engine';

interface ExecutionState {
  engine: ExecutionEngine | null;
  currentStep: AlgorithmStep | null;
  currentIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number; // steps per second
  truncated: boolean;
  algorithmId: string | null;
  problemSnapshot: unknown;
  /** Non-null when the last loadAlgorithm call failed validation. */
  loadError: string | null;
  /** Non-null when validation produced non-fatal warnings. */
  loadWarning: string | null;
  /** Cumulative logs up to the current index. */
  logs: LogEntry[];

  loadAlgorithm: (runner: AlgorithmRunner, problem: unknown, algorithmId?: string) => Promise<void>;
  stepForward: () => void;
  stepBackward: () => void;
  seekToStep: (index: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  clear: () => void;
  clearLogs: () => void;
}

export const useExecutionStore = create<ExecutionState>()(
  immer((set, get) => ({
    engine: null,
    currentStep: null,
    currentIndex: -1,
    totalSteps: 0,
    isPlaying: false,
    speed: 1,
    truncated: false,
    algorithmId: null,
    problemSnapshot: null,
    loadError: null,
    loadWarning: null,
    logs: [],

    loadAlgorithm: async (runner, problem, algorithmId) => {
      const { currentIndex: prevIndex } = get();
      const engine = new ExecutionEngine();
      try {
        let actualProblem = problem;
        if (
          actualProblem &&
          typeof actualProblem === 'object' &&
          'graph' in actualProblem &&
          actualProblem.graph
        ) {
          const { Graph } = await import('@/types/problem');
          const p = actualProblem as { graph: any };
          if (!(p.graph instanceof Graph)) {
            actualProblem = { ...actualProblem, graph: new Graph(p.graph) };
          }
        }
        engine.load(runner, actualProblem);
      } catch (err) {
        // Invalid problem (e.g. empty graph, missing start/goal) — store the
        // error message but DON'T throw so React's error boundary is never hit.
        const msg = err instanceof Error ? err.message : String(err);
        set(state => {
          state.engine = null;
          state.currentStep = null;
          state.currentIndex = -1;
          state.totalSteps = 0;
          state.isPlaying = false;
          state.loadError = msg;
          state.loadWarning = null;
          state.algorithmId = algorithmId ?? null;
          state.logs = [];
        });
        return;
      }

      set(state => {
        state.engine = engine as ExecutionEngine;
        state.totalSteps = engine.totalSteps;
        state.logs = [];
        
        // Preserve index if we were already viewing a trace
        const targetIndex = prevIndex >= 0 
          ? Math.min(prevIndex, engine.totalSteps - 1)
          : -1;

        if (targetIndex >= 0) {
          const step = engine.seekToStep(targetIndex);
          state.currentStep = step;
          state.currentIndex = targetIndex;
          
          // Aggregate logs up to targetIndex
          const allLogs: LogEntry[] = [];
          for (let i = 0; i <= targetIndex; i++) {
             const s = engine.seekToStep(i);
             if (s?.logs) allLogs.push(...s.logs);
          }
          state.logs = allLogs;
        } else {
          state.currentStep = null;
          state.currentIndex = -1;
        }

        state.isPlaying = false;
        state.truncated = engine.truncated;
        state.algorithmId = algorithmId ?? null;
        state.problemSnapshot = problem;
        state.loadError = null;
        state.loadWarning = engine.validationWarnings.length > 0 ? engine.validationWarnings.join(' ') : null;
      });
    },

    stepForward: () => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.stepForward();
      set(state => {
        if (step !== null) {
          state.currentStep = step;
          if (step.logs) state.logs.push(...step.logs);
        }
        state.currentIndex = engine.currentIndex;
        if (engine.isAtEnd) state.isPlaying = false;
      });
    },

    stepBackward: () => {
      const { engine, currentIndex } = get();
      if (!engine || currentIndex <= 0) return;
      const targetIndex = currentIndex - 1;
      const step = engine.seekToStep(targetIndex);
      
      const allLogs: LogEntry[] = [];
      for (let i = 0; i <= targetIndex; i++) {
        const s = engine.seekToStep(i);
        if (s?.logs) allLogs.push(...s.logs);
      }

      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = targetIndex;
        state.logs = allLogs;
        state.isPlaying = false;
      });
    },

    seekToStep: (index) => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.seekToStep(index);
      
      const allLogs: LogEntry[] = [];
      for (let i = 0; i <= index; i++) {
        const s = engine.seekToStep(i);
        if (s?.logs) allLogs.push(...s.logs);
      }

      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = index;
        state.logs = allLogs;
        state.isPlaying = false;
      });
    },

    jumpToStart: () => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.seekToStep(0);
      set(state => {
        if (step !== null) {
          state.currentStep = step;
          state.logs = step.logs ? [...step.logs] : [];
        }
        state.currentIndex = 0;
        state.isPlaying = false;
      });
    },

    jumpToEnd: () => {
      const { engine } = get();
      if (!engine) return;
      const lastIndex = engine.totalSteps - 1;
      const step = engine.seekToStep(lastIndex);
      
      const allLogs: LogEntry[] = [];
      for (let i = 0; i <= lastIndex; i++) {
        const s = engine.seekToStep(i);
        if (s?.logs) allLogs.push(...s.logs);
      }

      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = lastIndex;
        state.logs = allLogs;
        state.isPlaying = false;
      });
    },

    play: () => set(state => { state.isPlaying = true; }),
    pause: () => set(state => { state.isPlaying = false; }),

    reset: () => {
      const { engine } = get();
      if (!engine) return;
      engine.reset();
      set(state => {
        state.currentStep = null;
        state.currentIndex = -1;
        state.isPlaying = false;
        state.logs = [];
      });
    },

    setSpeed: (speed) => set(state => { state.speed = speed; }),

    clear: () => {
      const { engine } = get();
      engine?.clear();
      set(state => {
        state.engine = null;
        state.currentStep = null;
        state.currentIndex = -1;
        state.totalSteps = 0;
        state.isPlaying = false;
        state.truncated = false;
        state.algorithmId = null;
        state.problemSnapshot = null;
        state.loadError = null;
        state.loadWarning = null;
        state.logs = [];
      });
    },

    clearLogs: () => set(state => { state.logs = []; }),
  }))
);
