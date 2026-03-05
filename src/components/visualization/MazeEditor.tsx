import { useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { useMazeStore } from '@/store/maze.store';
import type { MazeOverlay } from '@/visualizations/adapters/maze.adapter';
import { MAZE_STRATEGY_LABELS } from '@/problems/maze/strategies';

interface MazeEditorProps {
  overlay?: MazeOverlay | null;
  className?: string;
}

const TOOL_LABELS = {
  wall: '🧱 Wall',
  erase: '🧼 Erase',
  terrain: '🌿 Terrain',
  start: '🚩 Start',
  goal: '🏁 Goal',
} as const;

const CELL_SIZE = 30;

function terrainEmoji(cost: number): string {
  if (cost <= 3) return '🌿';
  if (cost <= 6) return '🌾';
  return '⛰️';
}

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
    setSeed,
    paintCell,
    clearWalls,
    clearTerrain,
    generateMaze,
  } = useMazeStore();

  const dragActiveRef = useRef(false);

  const walls = useMemo(() => new Set(problem.walls), [problem.walls]);

  const isBlocked = useCallback((r: number, c: number) => walls.has(`r${r}c${c}`), [walls]);

  const applyBrush = useCallback((r: number, c: number) => {
    const radius = Math.max(0, brushSize - 1);
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= problem.rows || nc < 0 || nc >= problem.cols) continue;
        if (Math.abs(dr) + Math.abs(dc) > radius) continue;
        paintCell(nr, nc);
      }
    }
  }, [brushSize, paintCell, problem.cols, problem.rows]);

  const onPointerDown = useCallback((r: number, c: number) => {
    dragActiveRef.current = true;
    applyBrush(r, c);
  }, [applyBrush]);

  const onPointerEnter = useCallback((r: number, c: number) => {
    if (!dragActiveRef.current) return;
    if (tool === 'start' || tool === 'goal') return;
    applyBrush(r, c);
  }, [applyBrush, tool]);

  const onPointerUp = useCallback(() => {
    dragActiveRef.current = false;
  }, []);

  const maxDimension = Math.max(problem.rows, problem.cols);
  const scale = maxDimension > 26 ? 0.8 : 1;
  const cellSize = Math.max(18, Math.round(CELL_SIZE * scale));

  const gridStyle = {
    gridTemplateColumns: `repeat(${problem.cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${problem.rows}, ${cellSize}px)`,
    gap: '2px',
  };

  return (
    <div className={cn('h-full w-full flex flex-col overflow-hidden', className)} onPointerUp={onPointerUp}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto">

        {/* Tool palette */}
        <div className="flex items-center gap-px p-0.5 rounded border border-[var(--border)] bg-[var(--bg)] shrink-0">
          {(Object.keys(TOOL_LABELS) as Array<keyof typeof TOOL_LABELS>).map((key) => (
            <button
              key={key}
              onClick={() => setTool(key)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-mono border transition-colors whitespace-nowrap',
                tool === key
                  ? 'text-[var(--accent)] border-[var(--accent)]/50 bg-[var(--accent-soft)]'
                  : 'text-[var(--text-2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
              )}
            >
              {TOOL_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[var(--border)] shrink-0" />

        {/* Brush size */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-[var(--text-2)]">
          <span>Brush</span>
          <input type="range" min={1} max={4} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-16"
          />
          <span className="w-3 text-center">{brushSize}</span>
        </div>

        {/* Terrain cost */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-[var(--text-2)]">
          <span>Cost</span>
          <input type="range" min={2} max={10} value={terrainValue}
            onChange={(e) => setTerrainValue(Number(e.target.value))}
            className="w-16"
          />
          <span className="w-3 text-center">{terrainValue}</span>
        </div>

        <div className="w-px h-4 bg-[var(--border)] shrink-0" />

        {/* Generation strategy */}
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as typeof strategy)}
          className="shrink-0 text-[11px] font-mono px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] cursor-pointer"
        >
          {Object.entries(MAZE_STRATEGY_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>

        {/* Seed */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-[var(--text-2)]">
          <span>Seed</span>
          <input
            type="number"
            value={problem.seed}
            onChange={(e) => setSeed(Number(e.target.value) || 1)}
            className="w-20 px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          />
        </div>

        {/* Action buttons */}
        <button
          onClick={generateMaze}
          className="shrink-0 text-[11px] font-mono px-2.5 py-1 rounded border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)] hover:border-[var(--accent)]/70 transition-colors"
        >
          Generate
        </button>
        <button
          onClick={clearWalls}
          className="shrink-0 text-[11px] font-mono px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          Clear Walls
        </button>
        <button
          onClick={clearTerrain}
          className="shrink-0 text-[11px] font-mono px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          Clear Terrain
        </button>
      </div>

      {/* ── Grid canvas ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--bg)]">
        <div className="p-3 inline-block" onPointerLeave={onPointerUp}>
          <div className="inline-grid" style={gridStyle}>
            {Array.from({ length: problem.rows }, (_, r) =>
              Array.from({ length: problem.cols }, (_, c) => {
                const id = `r${r}c${c}`;
                const isStart = problem.startNode === id;
                const isGoal = problem.goalNode === id;
                const blocked = isBlocked(r, c);
                const terrainCost = problem.terrain[id] ?? 1;
                const isFrontier = overlay?.frontier.has(id);
                const isCurrent = overlay?.currentNode === id;
                const isPath = overlay?.pathNodes.has(id);
                const isExplored = overlay?.explored.has(id);

                const cellStyle: CSSProperties = {
                  width: cellSize,
                  height: cellSize,
                  background: 'transparent',
                  borderColor: 'rgba(88,108,126,0.2)',
                  touchAction: 'none',
                };

                if (blocked) {
                  cellStyle.background = 'repeating-linear-gradient(135deg, #0b1119, #0b1119 6px, #131f2d 6px, #131f2d 12px)';
                  cellStyle.borderColor = 'rgba(88,108,126,0.6)';
                } else if (isCurrent) {
                  cellStyle.background = 'rgba(240,136,62,0.30)';
                  cellStyle.borderColor = 'rgba(240,136,62,0.75)';
                } else if (isPath) {
                  cellStyle.background = 'rgba(83,200,128,0.25)';
                  cellStyle.borderColor = 'rgba(83,200,128,0.65)';
                } else if (isFrontier) {
                  cellStyle.background = 'rgba(95,179,255,0.22)';
                  cellStyle.borderColor = 'rgba(95,179,255,0.70)';
                } else if (isExplored) {
                  cellStyle.background = 'rgba(111,129,150,0.18)';
                  cellStyle.borderColor = 'rgba(111,129,150,0.40)';
                } else if (terrainCost > 1) {
                  const alpha = Math.min(0.45, 0.12 + terrainCost * 0.03);
                  cellStyle.background = `linear-gradient(180deg, rgba(198,135,69,${alpha + 0.08}), rgba(132,88,49,${alpha}))`;
                  cellStyle.borderColor = 'rgba(198,135,69,0.55)';
                }

                const cellEmoji = blocked
                  ? '🧱'
                  : isStart
                    ? '🚩'
                    : isGoal
                      ? '🏁'
                      : terrainCost > 1
                        ? terrainEmoji(terrainCost)
                        : null;

                return (
                  <button
                    key={id}
                    type="button"
                    className="border rounded-[4px] transition-colors duration-75 flex items-center justify-center"
                    style={cellStyle}
                    onPointerDown={() => onPointerDown(r, c)}
                    onPointerEnter={() => onPointerEnter(r, c)}
                    title={`${id}${terrainCost > 1 ? ` cost=${terrainCost}` : ''}${blocked ? ' wall' : ''}`}
                  >
                    {cellEmoji && (
                      <span className={cn('leading-none select-none', blocked ? 'text-[12px]' : 'text-[10px]')}>
                        {cellEmoji}
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center flex-wrap gap-x-4 gap-y-1 px-3 py-1.5 border-t border-[var(--border)] bg-[var(--surface)] text-[10px] font-mono text-[var(--text-3)]">
        <span>🧱 Wall</span>
        <span>🌿 Terrain</span>
        <span>🚩 Start</span>
        <span>🏁 Goal</span>
        <span className="w-px h-3 bg-[var(--border)]" />
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
