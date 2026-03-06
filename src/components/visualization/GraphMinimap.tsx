import { useMemo } from 'react';
import type { SVGNodeVM } from './svg-graph.types';
import { MINIMAP_DOT_COLORS, MINIMAP_DOT_COLORS_LIGHT } from './svg-graph.types';
import type { ZoomTransform } from 'd3';
import { usePreferencesStore } from '@/store/preferences.store';
import { Plus, Minus, Search, LayoutGrid } from '@/components/shared/Icons';

interface GraphMinimapProps {
  nodes: SVGNodeVM[];
  transform: ZoomTransform;
  canvasWidth: number;
  canvasHeight: number;
  zoomLevel?: number;
  onViewJump?: (x: number, y: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onAutoLayout?: () => void;
}

const MINIMAP_W = 156;
const MINIMAP_H = 96;
const PAD = 40;

export default function GraphMinimap({
  nodes,
  transform,
  canvasWidth,
  canvasHeight,
  zoomLevel,
  onViewJump,
  onZoomIn,
  onZoomOut,
  onFit,
  onAutoLayout,
}: GraphMinimapProps) {
  if (nodes.length === 0) return null;

  const darkMode = usePreferencesStore((s) => s.darkMode);
  const dotColors = darkMode ? MINIMAP_DOT_COLORS : MINIMAP_DOT_COLORS_LIGHT;

  const { dots, vx, vy, vw, vh, bbX1, bbY1, scale, offsetX, offsetY } = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    }

    const bbX2 = maxX + PAD;
    const bbY2 = maxY + PAD;
    const nextBbX1 = minX - PAD;
    const nextBbY1 = minY - PAD;
    const bw = bbX2 - nextBbX1 || 1;
    const bh = bbY2 - nextBbY1 || 1;
    const nextScale = Math.min(MINIMAP_W / bw, MINIMAP_H / bh);
    const nextOffsetX = (MINIMAP_W - bw * nextScale) / 2;
    const nextOffsetY = (MINIMAP_H - bh * nextScale) / 2;

    const nextDots = nodes.map((node) => ({
      id: node.id,
      cx: (node.x - nextBbX1) * nextScale + nextOffsetX,
      cy: (node.y - nextBbY1) * nextScale + nextOffsetY,
      color: dotColors[node.state] ?? '#94A3B8',
    }));

    const invTL = transform.invert([0, 0]);
    const invBR = transform.invert([canvasWidth, canvasHeight]);
    const nextVx = (invTL[0] - nextBbX1) * nextScale + nextOffsetX;
    const nextVy = (invTL[1] - nextBbY1) * nextScale + nextOffsetY;
    const nextVw = (invBR[0] - invTL[0]) * nextScale;
    const nextVh = (invBR[1] - invTL[1]) * nextScale;

    return {
      dots: nextDots,
      vx: nextVx,
      vy: nextVy,
      vw: nextVw,
      vh: nextVh,
      bbX1: nextBbX1,
      bbY1: nextBbY1,
      scale: nextScale,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    };
  }, [nodes, transform, canvasWidth, canvasHeight, dotColors]);

  const clampedX = Math.max(0, Math.min(vx, MINIMAP_W));
  const clampedY = Math.max(0, Math.min(vy, MINIMAP_H));
  const clampedW = Math.max(0, Math.min(vw, MINIMAP_W - clampedX));
  const clampedH = Math.max(0, Math.min(vh, MINIMAP_H - clampedY));

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onViewJump) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const gx = (mx - offsetX) / scale + bbX1;
    const gy = (my - offsetY) / scale + bbY1;

    onViewJump(gx, gy);
  };

  return (
    <div className="absolute bottom-3 left-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/94 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Minimap</p>
          <p className="text-[11px] text-[var(--text-2)]">Click to recenter</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-mono text-[var(--text)]">
          {Math.round((zoomLevel ?? transform.k) * 100)}%
        </div>
      </div>

      <div
        className="group relative cursor-crosshair border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(88,166,255,0.04),transparent)]"
        onClick={handleMinimapClick}
        style={{ width: MINIMAP_W, height: MINIMAP_H }}
      >
        <div className="absolute inset-0 bg-transparent transition-colors group-hover:bg-[var(--accent-soft)]/5" />
        <svg width={MINIMAP_W} height={MINIMAP_H} className="pointer-events-none">
          {dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.cx}
              cy={dot.cy}
              r={2.8}
              fill={dot.color}
            />
          ))}
          <rect
            x={clampedX}
            y={clampedY}
            width={clampedW}
            height={clampedH}
            fill="rgba(88,166,255,0.09)"
            stroke="#58A6FF"
            strokeWidth={1.6}
            rx={3}
          />
        </svg>
      </div>

      <div className="grid grid-cols-4 gap-1 p-2">
        <button
          onClick={onZoomOut}
          className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          title="Zoom out"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={onFit}
          className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          title="Fit graph"
        >
          <Search size={14} />
        </button>
        <button
          onClick={onAutoLayout}
          className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          title="Auto-layout"
        >
          <LayoutGrid size={14} />
        </button>
        <button
          onClick={onZoomIn}
          className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          title="Zoom in"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
