import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProblemCategory, SavedProblem } from '@/types/problem';
import { serializeWithSetMap, deserializeWithSetMap } from '@/lib/serialization';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SavedProblemsState {
  problems: SavedProblem[];
  saveProblem: (name: string, category: ProblemCategory, problem: unknown) => string;
  deleteProblem: (id: string) => void;
  renameProblem: (id: string, name: string) => void;
}

export const useSavedProblemsStore = create<SavedProblemsState>()(
  persist(
    (set, get) => ({
      problems: [],

      saveProblem: (name, category, problem) => {
        const existing = get().problems.find(p => p.name === name && p.category === category);
        const id = existing ? existing.id : crypto.randomUUID();

        set((state) => {
          if (existing) {
            return {
              problems: state.problems.map(p =>
                p.id === id ? { ...p, problem, createdAt: new Date().toISOString() } : p
              )
            };
          }
          const entry: SavedProblem = {
            id,
            name,
            category,
            problem,
            createdAt: new Date().toISOString(),
          };
          return { problems: [...state.problems, entry] };
        });
        
        return id;
      },

      deleteProblem: (id) => {
        set((state) => ({ problems: state.problems.filter((p) => p.id !== id) }));
      },

      renameProblem: (id, name) => {
        set((state) => ({
          problems: state.problems.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
      },
    }),
    {
      name: 'praxis-saved-problems',
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          return deserializeWithSetMap(raw) as ReturnType<typeof JSON.parse>;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, serializeWithSetMap(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    },
  ),
);
