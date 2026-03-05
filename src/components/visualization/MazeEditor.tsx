import { useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useMazeStore } from '@/store/maze.store';
import type { MazeOverlay } from '@/visualizations/adapters/maze.adapter';
import { MAZE_STRATEGY_LABELS } from '@/problems/maze/strategies';
import { usePreferencesStore } from '@/store/preferences.store';

interface MazeEditorProps {
  overlay?: MazeOverlay | null;
  className?: string;
}

const TOOL_LABELS = {
  wall: 'Wall',
  erase: 'Erase',
  terrain: 'Terrain',
  start: 'Start',
  goal: 'Goal',
} as const;

const CELL_SIZE = 24;
const GAP = 1;

export default function MazeEditor({ overlay, className }: MazeEditorProps) {
  const {
    problem,
    tool,
    brushSize,
    terrainValue,
    strategy,
    setTool,
    setBrushSize,
    setTerrainValue,
    setStrategy,
    paintCells,
    clearWalls,
    clearTerrain,
    generateMaze,
  } = useMazeStore();

  const darkMode = usePreferencesStore((s) => s.darkMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragActiveRef = useRef(false);

  const walls = useMemo(() => new Set(problem.walls), [problem.walls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = problem.cols * (CELL_SIZE + GAP) + GAP;
    const height = problem.rows * (CELL_SIZE + GAP) + GAP;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = darkMode ? '#0d1117' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    for (let r = 0; r < problem.rows; r++) {
      for (let c = 0; c < problem.cols; c++) {
        const id = `r${r}c${c}`;
        const isStart = problem.startNode === id;
        const isGoal = problem.goalNode === id;
        const isWall = walls.has(id);
        const terrainCost = problem.terrain[id] ?? 1;
        const isFrontier = overlay?.frontier.has(id);
        const isCurrent = overlay?.currentNode === id;
        const isPath = overlay?.pathNodes.has(id);
        const isExplored = overlay?.explored.has(id);

        const x = c * (CELL_SIZE + GAP) + GAP;
        const y = r * (CELL_SIZE + GAP) + GAP;

        let fill = darkMode ? '#161b22' : '#f6f8fa';
        let stroke = darkMode ? 'rgba(48,54,61,0.5)' : 'rgba(208,215,222,0.5)';

        if (isWall) {
          fill = darkMode ? '#010409' : '#1f2937';
          stroke = darkMode ? '#30363d' : '#374151';
        } else if (isCurrent) {
          fill = 'rgba(240,136,62,0.35)';
          stroke = 'rgba(240,136,62,0.8)';
        } else if (isPath) {
          fill = 'rgba(83,200,128,0.3)';
          stroke = 'rgba(83,200,128,0.7)';
        } else if (isFrontier) {
          fill = 'rgba(95,179,255,0.25)';
          stroke = 'rgba(95,179,255,0.8)';
        } else if (isExplored) {
          fill = darkMode ? 'rgba(111,129,150,0.2)' : 'rgba(111,129,150,0.1)';
          stroke = 'rgba(111,129,150,0.4)';
        } else if (terrainCost > 1) {
          const alpha = Math.min(0.5, 0.1 + terrainCost * 0.04);
          fill = `rgba(198,135,69,${alpha})`;
          stroke = 'rgba(198,135,69,0.6)';
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 4);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isWall) {
          ctx.fillStyle = darkMode ? '#d0d7de' : '#f9fafb';
          ctx.font = '700 10px JetBrains Mono, monospace';
          ctx.fillText('W', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        } else if (isStart) {
          ctx.fillStyle = '#A371F7';
          ctx.font = '700 10px JetBrains Mono, monospace';
          ctx.fillText('S', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        } else if (isGoal) {
          ctx.fillStyle = '#3FB950';
          ctx.font = '700 10px JetBrains Mono, monospace';
          ctx.fillText('G', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        } else if (terrainCost > 1) {
          ctx.fillStyle = darkMode ? '#F2CC8F' : '#8B5E34';
          ctx.font = '600 9px JetBrains Mono, monospace';
          ctx.fillText(String(terrainCost), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        }
      }
    }
  }, [problem, walls, overlay, darkMode]);

  const getCoords = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor((x - GAP) / (CELL_SIZE + GAP));
    const r = Math.floor((y - GAP) / (CELL_SIZE + GAP));
    if (r < 0 || r >= problem.rows || c < 0 || c >= problem.cols) return null;
    return { row: r, col: c };
  };

  const applyBrush = useCallback((r: number, c: number) => {
    const radius = Math.max(0, brushSize - 1);
    const cells: { row: number; col: number }[] = [];

    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= problem.rows || nc < 0 || nc >= problem.cols) continue;
        if (Math.abs(dr) + Math.abs(dc) > radius) continue;
        cells.push({ row: nr, col: nc });
      }
    }

    if (cells.length > 0) {
      paintCells(cells);
    }
  }, [brushSize, paintCells, problem.cols, problem.rows]);

  const onPointerDown = (e: React.PointerEvent) => {
    const coords = getCoords(e);
    if (!coords) return;
    dragActiveRef.current = true;
    applyBrush(coords.row, coords.col);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragActiveRef.current) return;
    if (tool === 'start' || tool === 'goal') return;
    const coords = getCoords(e);
    if (!coords) return;
    applyBrush(coords.row, coords.col);
  };

  const onPointerUp = () => {
    dragActiveRef.current = false;
  };

  return (
    <div className={cn('h-full w-full flex flex-col overflow-hidden', className)}>
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[240px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-2">
            <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Draw Tools</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(TOOL_LABELS) as Array<keyof typeof TOOL_LABELS>).map((key) => (
                <button
                  key={key}
                  onClick={() => setTool(key)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-[11px] font-mono border transition-colors whitespace-nowrap',
                    tool === key
                      ? 'text-[var(--text)] border-[var(--accent)]/45 bg-[var(--accent-soft)]'
                      : 'text-[var(--text-2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface)]',
                  )}
                >
                  {TOOL_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
            <p className="pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Brush</p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-2)]">
              <input type="range" min={1} max={4} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24" />
              <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]">{brushSize}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
            <p className="pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Terrain Cost</p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-2)]">
              <input type="range" min={2} max={10} value={terrainValue} onChange={(e) => setTerrainValue(Number(e.target.value))} className="w-24" />
              <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]">{terrainValue}</span>
            </div>
          </div>

          <div className="min-w-[260px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
            <p className="pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Generation</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as typeof strategy)}
                className="min-w-[180px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-mono text-[var(--text)]"
              >
                {Object.entries(MAZE_STRATEGY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>

              <button
                onClick={generateMaze}
                className="shrink-0 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2 text-[11px] font-mono text-[var(--accent)] transition-colors hover:border-[var(--accent)]/70"
              >
                Generate Maze
              </button>
              <button
                onClick={clearWalls}
                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              >
                Clear Walls
              </button>
              <button
                onClick={clearTerrain}
                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              >
                Reset Terrain
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/35 px-3 py-2 text-[11px] text-[var(--text-2)]">
          <span><span className="text-[var(--text-3)]">Active Tool:</span> {TOOL_LABELS[tool]}</span>
          <span><span className="text-[var(--text-3)]">Brush:</span> {brushSize}</span>
          <span><span className="text-[var(--text-3)]">Terrain:</span> {terrainValue}</span>
          <span><span className="text-[var(--text-3)]">Grid:</span> {problem.rows} × {problem.cols}</span>
          <span><span className="text-[var(--text-3)]">Strategy:</span> {MAZE_STRATEGY_LABELS[strategy]}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-[var(--bg)] custom-scrollbar">
        <div className="p-4 flex items-center justify-center min-h-full">
          <div className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(88,166,255,0.05),transparent)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="shadow-xl rounded-sm touch-none"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center flex-wrap gap-x-4 gap-y-1 px-3 py-1.5 border-t border-[var(--border)] bg-[var(--surface)] text-[10px] font-mono text-[var(--text-3)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'rgba(95,179,255,0.3)', border: '1px solid rgba(95,179,255,0.7)' }} />
          Frontier
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'rgba(240,136,62,0.35)', border: '1px solid rgba(240,136,62,0.75)' }} />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'rgba(83,200,128,0.3)', border: '1px solid rgba(83,200,128,0.65)' }} />
          Path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'rgba(111,129,150,0.25)', border: '1px solid rgba(111,129,150,0.45)' }} />
          Explored
        </span>
      </div>
    </div>
  );
}
