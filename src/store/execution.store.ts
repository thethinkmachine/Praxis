import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AlgorithmStep, AlgorithmRunner } from '@/types';
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

  loadAlgorithm: (runner: AlgorithmRunner, problem: unknown, algorithmId?: string) => void;
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

    loadAlgorithm: (runner, problem, algorithmId) => {
      const engine = new ExecutionEngine();
      try {
        engine.load(runner, problem);
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
        });
        return;
      }
      set(state => {
        state.engine = engine as ExecutionEngine;
        state.totalSteps = engine.totalSteps;
        state.currentStep = null;
        state.currentIndex = -1;
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
        if (step !== null) state.currentStep = step;
        state.currentIndex = engine.currentIndex;
        if (engine.isAtEnd) state.isPlaying = false;
      });
    },

    stepBackward: () => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.stepBackward();
      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = engine.currentIndex;
        state.isPlaying = false;
      });
    },

    seekToStep: (index) => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.seekToStep(index);
      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = engine.currentIndex;
        state.isPlaying = false;
      });
    },

    jumpToStart: () => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.seekToStep(0);
      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = 0;
        state.isPlaying = false;
      });
    },

    jumpToEnd: () => {
      const { engine } = get();
      if (!engine) return;
      const step = engine.seekToStep(engine.totalSteps - 1);
      set(state => {
        if (step !== null) state.currentStep = step;
        state.currentIndex = engine.totalSteps - 1;
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
      });
    },
  }))
);
