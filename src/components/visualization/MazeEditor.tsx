import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import type { GraphData, GraphNode, GraphEdge } from '@/types/problem';

// ── Types ─────────────────────────────────────────────────────────────────────

type CellType = 'empty' | 'wall' | 'start' | 'goal';
type AlgoState = 'frontier' | 'explored' | 'current' | 'path' | 'normal';
type EditMode = 'wall' | 'start' | 'goal' | 'erase';

export interface MazeAlgorithmOverlay {
  frontier: Set<string>;
  explored: Set<string>;
  currentNode: string | null;
  pathNodes: Set<string>;
}

interface MazeEditorProps {
  rows?: number;
  cols?: number;
  onMazeChange: (graphData: GraphData, startId: string, goalId: string) => void;
  algorithmOverlay?: MazeAlgorithmOverlay | null;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const cellId = (r: number, c: number) => `r${r}c${c}`;

function mazeToGraph(
  rows: number,
  cols: number,
  walls: Set<string>,
  goalR: number,
  goalC: number,
): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cellId(r, c);
      if (!walls.has(id)) {
        nodes.push({
          id,
          label: id,
          x: c * 72,
          y: r * 72,
          heuristic: Math.abs(goalR - r) + Math.abs(goalC - c),
        });
      }
    }
  }

  const nodeSet = new Set(nodes.map(n => n.id));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cellId(r, c);
      if (!nodeSet.has(id)) continue;
      const neighbors: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nid = cellId(nr, nc);
        if (!nodeSet.has(nid)) continue;
        // Only add edge once (ordered)
        if (nr * cols + nc > r * cols + c) {
          edges.push({ id: `e-${id}-${nid}`, source: id, target: nid, weight: 1 });
        }
      }
    }
  }

  return { nodes, edges, directed: false };
}

// ── Component ─────────────────────────────────────────────────────────────────

const CELL_SIZE = 38;

export default function MazeEditor({
  rows = 10,
  cols = 14,
  onMazeChange,
  algorithmOverlay,
  className,
}: MazeEditorProps) {
  const [walls, setWalls] = useState<Set<string>>(new Set<string>());
  const [startCell, setStartCell] = useState<[number, number]>([0, 0]);
  const [goalCell, setGoalCell] = useState<[number, number]>([rows - 1, cols - 1]);
  const [editMode, setEditMode] = useState<EditMode>('wall');
  const isDragging = useRef(false);
  const dragMode = useRef<'add' | 'remove'>('add');
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced publish — visual state updates instantly, algorithm reloads 250ms after last change
  const publishMaze = useCallback((
    newWalls: Set<string>,
    start: [number, number],
    goal: [number, number],
  ) => {
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    publishTimerRef.current = setTimeout(() => {
      const graphData = mazeToGraph(rows, cols, newWalls, goal[0], goal[1]);
      const startId = cellId(start[0], start[1]);
      const goalId = cellId(goal[0], goal[1]);
      if (!newWalls.has(startId) && !newWalls.has(goalId)) {
        onMazeChange(graphData, startId, goalId);
      }
    }, 250);
  }, [rows, cols, onMazeChange]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
  }, []);

  // Publish on mount
  useEffect(() => {
    publishMaze(walls, startCell, goalCell);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellInteract = useCallback((r: number, c: number, isStart: boolean) => {
    const id = cellId(r, c);
    const isStartCell = startCell[0] === r && startCell[1] === c;
    const isGoalCell = goalCell[0] === r && goalCell[1] === c;

    if (editMode === 'start') {
      if (!walls.has(id)) {
        const newStart: [number, number] = [r, c];
        setStartCell(newStart);
        publishMaze(walls, newStart, goalCell);
      }
      return;
    }
    if (editMode === 'goal') {
      if (!walls.has(id)) {
        const newGoal: [number, number] = [r, c];
        setGoalCell(newGoal);
        publishMaze(walls, startCell, newGoal);
      }
      return;
    }

    // Wall / erase mode
    if (isStartCell || isGoalCell) return; // Can't wall start/goal

    const newWalls = new Set(walls);
    if (editMode === 'erase') {
      newWalls.delete(id);
    } else {
      // wall mode: on first click determine add/remove based on current state
      if (isStart) {
        dragMode.current = walls.has(id) ? 'remove' : 'add';
      }
      if (dragMode.current === 'add') {
        newWalls.add(id);
      } else {
        newWalls.delete(id);
      }
    }
    setWalls(newWalls);
    publishMaze(newWalls, startCell, goalCell);
  }, [editMode, walls, startCell, goalCell, publishMaze]);

  const handleMouseDown = useCallback((r: number, c: number) => {
    isDragging.current = true;
    handleCellInteract(r, c, true);
  }, [handleCellInteract]);

  const handleMouseEnter = useCallback((r: number, c: number) => {
    if (!isDragging.current) return;
    if (editMode === 'wall' || editMode === 'erase') {
      handleCellInteract(r, c, false);
    }
  }, [editMode, handleCellInteract]);

  useEffect(() => {
    const up = () => { isDragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  function clearAll() {
    const newWalls = new Set<string>();
    setWalls(newWalls);
    publishMaze(newWalls, startCell, goalCell);
  }

  function generateMaze() {
    // Randomized DFS maze — walls are cells NOT in the passage set
    const passageSet = new Set<string>();
    const visited = new Set<string>();
    const stack: [number, number][] = [[0, 0]];
    visited.add(cellId(0, 0));
    passageSet.add(cellId(0, 0));

    function shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    while (stack.length > 0) {
      const [r, c] = stack[stack.length - 1];
      const ns: [number, number][] = [[r-2,c],[r+2,c],[r,c-2],[r,c+2]].filter(
        ([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(cellId(nr, nc))
      ) as [number, number][];

      if (ns.length === 0) { stack.pop(); continue; }
      const [nr, nc] = shuffle(ns)[0];
      const wallR = (r + nr) / 2;
      const wallC = (c + nc) / 2;
      visited.add(cellId(nr, nc));
      passageSet.add(cellId(nr, nc));
      passageSet.add(cellId(wallR, wallC));
      stack.push([nr, nc]);
    }

    // All cells not in passages are walls
    const newWalls = new Set<string>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!passageSet.has(cellId(r, c))) newWalls.add(cellId(r, c));
      }
    }
    // Ensure start and goal are not walled
    newWalls.delete(cellId(startCell[0], startCell[1]));
    newWalls.delete(cellId(goalCell[0], goalCell[1]));

    setWalls(newWalls);
    publishMaze(newWalls, startCell, goalCell);
  }

  // Determine visual state of a cell
  function cellVisualState(r: number, c: number): { bg: string; text?: string; glow?: string } {
    const id = cellId(r, c);
    const isStart = startCell[0] === r && startCell[1] === c;
    const isGoal = goalCell[0] === r && goalCell[1] === c;
    const isWall = walls.has(id);

    if (isWall) return { bg: '#0A0C10' };

    const ov = algorithmOverlay;
    if (ov) {
      if (id === ov.currentNode) return { bg: '#2D1600', text: '#FFA657', glow: '#F0883E' };
      if (ov.pathNodes.has(id) && !isStart && !isGoal) return { bg: '#1C1200', text: '#F0C55A', glow: '#E3B341' };
      if (ov.frontier.has(id) && !isStart && !isGoal) return { bg: '#07182E', text: '#79C0FF', glow: '#58A6FF' };
      if (ov.explored.has(id) && !isStart && !isGoal) return { bg: '#161B22', text: '#374151' };
    }

    if (isStart) return { bg: '#110A26', text: '#E2C5FF', glow: '#A371F7' };
    if (isGoal) return { bg: '#041409', text: '#56D364', glow: '#3FB950' };
    return { bg: '#161B22' };
  }

  const editModes: { mode: EditMode; label: string; icon: string; active: string }[] = [
    { mode: 'wall', label: 'Wall', icon: '▪', active: '#FF7B72' },
    { mode: 'erase', label: 'Erase', icon: '◻', active: '#58A6FF' },
    { mode: 'start', label: 'Start', icon: 'S', active: '#A371F7' },
    { mode: 'goal', label: 'Goal', icon: 'G', active: '#3FB950' },
  ];

  return (
    <div className={cn('flex flex-col gap-3 items-center', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded border border-[var(--border)] p-1">
          {editModes.map(({ mode, label, icon, active }) => (
            <button
              key={mode}
              onClick={() => setEditMode(mode)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1',
                editMode === mode
                  ? 'text-white'
                  : 'text-[var(--text-2)] hover:text-[var(--text)]',
              )}
              style={editMode === mode ? { backgroundColor: active + '33', color: active, borderColor: active } : {}}
              title={label}
            >
              <span className="text-xs leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={generateMaze}
          className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[11px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[#58A6FF]/50 transition-all"
        >
          Generate Maze
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[11px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[#FF7B72]/50 transition-all"
        >
          Clear
        </button>
      </div>

      {/* Grid */}
      <div
        className="relative cursor-crosshair select-none"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
          gap: '2px',
          backgroundColor: '#1C2740',
          borderRadius: '6px',
          padding: '4px',
          border: '1px solid #30363D',
        }}
        onMouseLeave={() => { isDragging.current = false; }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const vs = cellVisualState(r, c);
            const isStart = startCell[0] === r && startCell[1] === c;
            const isGoal = goalCell[0] === r && goalCell[1] === c;
            const isWall = walls.has(cellId(r, c));

            return (
              <div
                key={`${r}-${c}`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: vs.bg,
                  borderRadius: isWall ? '2px' : '4px',
                  border: vs.glow ? `1px solid ${vs.glow}44` : '1px solid transparent',
                  boxShadow: vs.glow ? `0 0 8px ${vs.glow}66, inset 0 0 6px ${vs.glow}22` : 'none',
                  transition: 'all 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: editMode === 'wall' || editMode === 'erase' ? 'crosshair' : 'pointer',
                }}
                onMouseDown={() => handleMouseDown(r, c)}
                onMouseEnter={() => handleMouseEnter(r, c)}
              >
                {isStart && (
                  <span style={{ color: '#E2C5FF', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>S</span>
                )}
                {isGoal && (
                  <span style={{ color: '#56D364', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>G</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-[var(--text-3)]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#110A26] border border-[#A371F7]/40 inline-block" />Start (S)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#041409] border border-[#3FB950]/40 inline-block" />Goal (G)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#07182E] border border-[#58A6FF]/40 inline-block" />Frontier</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#2D1600] border border-[#F0883E]/40 inline-block" />Current</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#1C1200] border border-[#E3B341]/40 inline-block" />Path</span>
      </div>
    </div>
  );
}
