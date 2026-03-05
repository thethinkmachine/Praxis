import { create } from 'zustand';
import type { AlgorithmStep, AlgorithmRunner } from '@/types';
import { ExecutionEngine } from '@/algorithms/core/engine';

interface SingleEngine {
  engine: ExecutionEngine | null;
  currentStep: AlgorithmStep | null;
  currentIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  algorithmId: string | null;
  label: string;
  loadError: string | null;
}

interface ComparisonState {
  left: SingleEngine;
  right: SingleEngine;
  synced: boolean;
  speed: number;

  loadLeft: (runner: AlgorithmRunner, problem: unknown, algorithmId?: string, label?: string) => void;
  loadRight: (runner: AlgorithmRunner, problem: unknown, algorithmId?: string, label?: string) => void;
  stepBoth: () => void;
  stepBackwardBoth: () => void;
  jumpToBothStart: () => void;
  jumpToBothEnd: () => void;
  seekBoth: (index: number) => void;
  setSynced: (synced: boolean) => void;
  setSpeed: (speed: number) => void;
  playBoth: () => void;
  pauseBoth: () => void;
  stepLeft: () => void;
  stepRight: () => void;
  stepBackwardLeft: () => void;
  stepBackwardRight: () => void;
  clearBoth: () => void;
}

const emptyEngine = (label: string): SingleEngine => ({
  engine: null,
  currentStep: null,
  currentIndex: -1,
  totalSteps: 0,
  isPlaying: false,
  algorithmId: null,
  label,
  loadError: null,
});

function applyStep(eng: SingleEngine, direction: 'forward' | 'backward' | number): SingleEngine {
  if (!eng.engine) return eng;
  let step: AlgorithmStep | null;
  if (typeof direction === 'number') {
    step = eng.engine.seekToStep(direction);
  } else if (direction === 'forward') {
    step = eng.engine.stepForward();
  } else {
    step = eng.engine.stepBackward();
  }
  return { ...eng, currentStep: step ?? eng.currentStep, currentIndex: eng.engine.currentIndex };
}

function loadSide(
  runner: AlgorithmRunner, problem: unknown, algorithmId?: string, label?: string, defaultLabel = 'Algorithm'
): SingleEngine {
  const engine = new ExecutionEngine();
  try {
    engine.load(runner, problem);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...emptyEngine(label ?? defaultLabel), algorithmId: algorithmId ?? null, loadError: msg };
  }
  return {
    engine,
    currentStep: null,
    currentIndex: -1,
    totalSteps: engine.totalSteps,
    isPlaying: false,
    algorithmId: algorithmId ?? null,
    label: label ?? defaultLabel,
    loadError: null,
  };
}

export const useComparisonStore = create<ComparisonState>()((set) => ({
  left: emptyEngine('Algorithm A'),
  right: emptyEngine('Algorithm B'),
  synced: true,
  speed: 1,

  loadLeft: (runner, problem, algorithmId, label) => set(() => ({
    left: loadSide(runner, problem, algorithmId, label, 'Algorithm A'),
  })),

  loadRight: (runner, problem, algorithmId, label) => set(() => ({
    right: loadSide(runner, problem, algorithmId, label, 'Algorithm B'),
  })),

  stepBoth: () => set((state) => ({
    left: applyStep(state.left, 'forward'),
    right: applyStep(state.right, 'forward'),
  })),

  stepBackwardBoth: () => set((state) => ({
    left: applyStep(state.left, 'backward'),
    right: applyStep(state.right, 'backward'),
  })),

  stepLeft: () => set((state) => ({ left: applyStep(state.left, 'forward') })),
  stepRight: () => set((state) => ({ right: applyStep(state.right, 'forward') })),
  stepBackwardLeft: () => set((state) => ({ left: applyStep(state.left, 'backward') })),
  stepBackwardRight: () => set((state) => ({ right: applyStep(state.right, 'backward') })),

  jumpToBothStart: () => set((state) => ({
    left: applyStep(state.left, 0),
    right: applyStep(state.right, 0),
  })),

  jumpToBothEnd: () => set((state) => ({
    left: applyStep(state.left, (state.left.totalSteps || 1) - 1),
    right: applyStep(state.right, (state.right.totalSteps || 1) - 1),
  })),

  seekBoth: (index) => set((state) => ({
    left: applyStep(state.left, index),
    right: applyStep(state.right, index),
  })),

  setSynced: (synced) => set({ synced }),
  setSpeed: (speed) => set({ speed }),

  playBoth: () => set((state) => ({
    left: { ...state.left, isPlaying: true },
    right: { ...state.right, isPlaying: true },
  })),

  pauseBoth: () => set((state) => ({
    left: { ...state.left, isPlaying: false },
    right: { ...state.right, isPlaying: false },
  })),

  clearBoth: () => set({
    left: emptyEngine('Algorithm A'),
    right: emptyEngine('Algorithm B'),
  }),
}));
