import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { MazeProblem } from '@/types/problem';
import {
  applyMazeStrategy,
  createDefaultMazeProblem,
  mazeCellId,
  normalizeMazeProblem,
  parseMazeCellId,
} from '@/problems/maze/maze';
import type { MazeGenerationStrategyId } from '@/problems/maze/strategies';

export type MazeTool = 'wall' | 'erase' | 'start' | 'goal' | 'terrain';

interface MazeState {
  problem: MazeProblem;
  tool: MazeTool;
  brushSize: number;
  terrainValue: number;
  strategy: MazeGenerationStrategyId;

  setProblem: (problem: MazeProblem) => void;
  setTool: (tool: MazeTool) => void;
  setBrushSize: (size: number) => void;
  setTerrainValue: (value: number) => void;
  setStrategy: (strategy: MazeGenerationStrategyId) => void;
  setSeed: (seed: number) => void;
  setDimensions: (rows: number, cols: number) => void;
  paintCell: (row: number, col: number) => void;
  paintCells: (coords: { row: number; col: number }[]) => void;
  clearWalls: () => void;
  clearTerrain: () => void;
  generateMaze: () => void;
  resetMaze: () => void;
}

function withProtectedCells(problem: MazeProblem): MazeProblem {
  const normalized = normalizeMazeProblem(problem);
  const wallSet = new Set(normalized.walls);
  wallSet.delete(normalized.startNode);
  wallSet.delete(normalized.goalNode);
  return { ...normalized, walls: Array.from(wallSet) };
}

export const useMazeStore = create<MazeState>()(
  persist(
    immer((set) => ({
      problem: applyMazeStrategy(createDefaultMazeProblem(), 'recursive-backtracker'),
      tool: 'wall',
      brushSize: 1,
      terrainValue: 3,
      strategy: 'recursive-backtracker',

      setProblem: (problem) => set((state) => {
        state.problem = withProtectedCells(problem);
      }),

      setTool: (tool) => set((state) => {
        state.tool = tool;
      }),

      setBrushSize: (size) => set((state) => {
        state.brushSize = Math.max(1, Math.min(4, Math.round(size)));
      }),

      setTerrainValue: (value) => set((state) => {
        state.terrainValue = Math.max(2, Math.min(20, Math.round(value)));
      }),

      setStrategy: (strategy) => set((state) => {
        state.strategy = strategy;
        state.problem.strategy = strategy;
      }),

      setSeed: (seed) => set((state) => {
        state.problem.seed = Math.max(1, Math.floor(seed));
      }),

      setDimensions: (rows, cols) => set((state) => {
        const current = state.problem;
        const resized = normalizeMazeProblem({
          ...current,
          rows: Math.max(4, Math.min(80, Math.floor(rows))),
          cols: Math.max(4, Math.min(80, Math.floor(cols))),
        });
        state.problem = withProtectedCells(resized);
      }),

      paintCell: (row, col) => set((state) => {
        const p = state.problem;
        if (row < 0 || row >= p.rows || col < 0 || col >= p.cols) return;
        const id = mazeCellId(row, col);
        const walls = new Set(p.walls);

        if (state.tool === 'start') {
          if (!walls.has(id)) p.startNode = id;
        } else if (state.tool === 'goal') {
          if (!walls.has(id)) p.goalNode = id;
        } else if (state.tool === 'wall') {
          if (id !== p.startNode && id !== p.goalNode) {
            walls.add(id);
            delete p.terrain[id];
          }
        } else if (state.tool === 'erase') {
          walls.delete(id);
          delete p.terrain[id];
        } else if (state.tool === 'terrain') {
          if (!walls.has(id) && id !== p.startNode && id !== p.goalNode) {
            p.terrain[id] = state.terrainValue;
          }
        }

        walls.delete(p.startNode);
        walls.delete(p.goalNode);
        p.walls = Array.from(walls);
      }),

      paintCells: (coords) => set((state) => {
        const p = state.problem;
        const walls = new Set(p.walls);
        let changed = false;

        for (const { row, col } of coords) {
          if (row < 0 || row >= p.rows || col < 0 || col >= p.cols) continue;
          const id = mazeCellId(row, col);

          if (state.tool === 'start') {
            if (!walls.has(id)) {
              p.startNode = id;
              changed = true;
            }
          } else if (state.tool === 'goal') {
            if (!walls.has(id)) {
              p.goalNode = id;
              changed = true;
            }
          } else if (state.tool === 'wall') {
            if (id !== p.startNode && id !== p.goalNode) {
              walls.add(id);
              delete p.terrain[id];
              changed = true;
            }
          } else if (state.tool === 'erase') {
            if (walls.has(id) || p.terrain[id] !== undefined) {
              walls.delete(id);
              delete p.terrain[id];
              changed = true;
            }
          } else if (state.tool === 'terrain') {
            if (!walls.has(id) && id !== p.startNode && id !== p.goalNode) {
              p.terrain[id] = state.terrainValue;
              changed = true;
            }
          }
        }

        if (changed) {
          walls.delete(p.startNode);
          walls.delete(p.goalNode);
          p.walls = Array.from(walls);
        }
      }),

      clearWalls: () => set((state) => {
        state.problem.walls = [];
      }),

      clearTerrain: () => set((state) => {
        state.problem.terrain = {};
      }),

      generateMaze: () => set((state) => {
        state.problem = withProtectedCells(applyMazeStrategy(state.problem, state.strategy, state.problem.seed));
      }),

      resetMaze: () => set((state) => {
        const next = applyMazeStrategy(createDefaultMazeProblem(), state.strategy);
        state.problem = next;
      }),
    })),
    {
      name: 'praxis-maze-state',
      partialize: (state) => ({
        problem: state.problem,
        tool: state.tool,
        brushSize: state.brushSize,
        terrainValue: state.terrainValue,
        strategy: state.strategy,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<MazeState>) };
        const normalized = withProtectedCells(merged.problem ?? createDefaultMazeProblem());

        // Ensure start/goal remain in bounds after restoring persisted data.
        const [sr, sc] = parseMazeCellId(normalized.startNode);
        const [gr, gc] = parseMazeCellId(normalized.goalNode);
        if (sr >= normalized.rows || sc >= normalized.cols || gr >= normalized.rows || gc >= normalized.cols) {
          merged.problem = createDefaultMazeProblem(normalized.rows, normalized.cols, normalized.seed);
        } else {
          merged.problem = normalized;
        }

        return merged as MazeState;
      },
    },
  ),
);
