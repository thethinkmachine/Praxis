import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { SVGNodeVM } from './svg-graph.types';
import { MINIMAP_DOT_COLORS, MINIMAP_DOT_COLORS_LIGHT } from './svg-graph.types';
import type { ZoomTransform } from 'd3';
import { usePreferencesStore } from '@/store/preferences.store';
import { Plus, Minus, Maximize2, Wand2, ChevronDown, ChevronUp } from '@/components/shared/Icons';

interface GraphMinimapProps {
  nodes: SVGNodeVM[];
  transform: ZoomTransform;
  canvasWidth: number;
  canvasHeight: number;
  onViewJump?: (x: number, y: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onAutoLayout?: () => void;
  disableAutoLayout?: boolean;
  storageKey?: string;
}

const MINIMAP_W = 156;
const MINIMAP_H = 96;
const PAD = 40;
const EDGE_MARGIN = 12;
// Approximate rendered panel height in each state — used to anchor the panel
// flush against a corner. Doesn't need to be pixel-exact: being a few px off
// just means a slightly looser margin, never a layout bug.
const PANEL_H_EXPANDED = 190;
const PANEL_H_COLLAPSED = 42;
const SNAP_DURATION_MS = 200;

type MinimapCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const CORNERS: MinimapCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const DEFAULT_CORNER: MinimapCorner = 'bottom-left';

interface MinimapPosition {
  x: number;
  y: number;
}

interface MinimapStoredState {
  corner: MinimapCorner;
  collapsed: boolean;
}

function clampToCanvas(pos: MinimapPosition, panelHeight: number, canvasWidth: number, canvasHeight: number): MinimapPosition {
  const maxX = Math.max(EDGE_MARGIN, canvasWidth - MINIMAP_W - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, canvasHeight - panelHeight - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(EDGE_MARGIN, pos.x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, pos.y), maxY),
  };
}

/** The panel's resting position is always derived fresh from its corner +
 *  current canvas/panel dimensions (like `position: absolute; right: 0`)
 *  rather than a stored pixel offset — so it stays flush against that corner
 *  through any resize (sidebar toggle, window resize, ...) instead of
 *  silently drifting away from it. */
function cornerToPosition(corner: MinimapCorner, panelHeight: number, canvasWidth: number, canvasHeight: number): MinimapPosition {
  const { x: maxX, y: maxY } = clampToCanvas({ x: Infinity, y: Infinity }, panelHeight, canvasWidth, canvasHeight);
  return {
    x: corner.endsWith('left') ? EDGE_MARGIN : maxX,
    y: corner.startsWith('top') ? EDGE_MARGIN : maxY,
  };
}

/** Which quadrant of the canvas a dropped position's center falls in —
 *  determines the corner it snaps to on release. */
function nearestCorner(pos: MinimapPosition, panelHeight: number, canvasWidth: number, canvasHeight: number): MinimapCorner {
  const centerX = pos.x + MINIMAP_W / 2;
  const centerY = pos.y + panelHeight / 2;
  const isLeft = centerX < canvasWidth / 2;
  const isTop = centerY < canvasHeight / 2;
  return `${isTop ? 'top' : 'bottom'}-${isLeft ? 'left' : 'right'}` as MinimapCorner;
}

function readStoredState(storageKey?: string): MinimapStoredState {
  const fallback: MinimapStoredState = { corner: DEFAULT_CORNER, collapsed: false };
  if (!storageKey || typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as
      | { corner?: string; collapsed?: boolean; x?: number; y?: number; position?: MinimapPosition }
      | null;
    if (!parsed) return fallback;

    const collapsed = typeof parsed.collapsed === 'boolean' ? parsed.collapsed : false;

    if (parsed.corner && (CORNERS as string[]).includes(parsed.corner)) {
      return { corner: parsed.corner as MinimapCorner, collapsed };
    }

    // Migrate a pre-snap free-pixel position (this component used to store
    // {x, y} directly) to whichever corner it was closest to, using a rough
    // default viewport size since the real canvas isn't measured yet here.
    const legacy = parsed.position ?? (typeof parsed.x === 'number' && typeof parsed.y === 'number' ? { x: parsed.x, y: parsed.y } : null);
    if (legacy) {
      const corner = nearestCorner(legacy, collapsed ? PANEL_H_COLLAPSED : PANEL_H_EXPANDED, 1024, 768);
      return { corner, collapsed };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export default function GraphMinimap({
  nodes,
  transform,
  canvasWidth,
  canvasHeight,
  onViewJump,
  onZoomIn,
  onZoomOut,
  onFit,
  onAutoLayout,
  disableAutoLayout = false,
  storageKey,
}: GraphMinimapProps) {
  const darkMode = usePreferencesStore((s) => s.darkMode);
  const dotColors = darkMode ? MINIMAP_DOT_COLORS : MINIMAP_DOT_COLORS_LIGHT;
  const hasNodes = nodes.length > 0;
  const storedStateRef = useRef<MinimapStoredState>(readStoredState(storageKey));
  const [collapsed, setCollapsed] = useState(() => storedStateRef.current.collapsed);
  const [corner, setCorner] = useState<MinimapCorner>(() => storedStateRef.current.corner);
  const panelRef = useRef<HTMLDivElement>(null);
  // Live position while actively dragging (free-following the pointer);
  // null once settled, at which point `corner` is the source of truth.
  const [dragPosition, setDragPosition] = useState<MinimapPosition | null>(null);
  const dragRef = useRef<{ pointerId: number; containerRect: DOMRect; dx: number; dy: number; lastPosition: MinimapPosition } | null>(null);

  const panelHeight = collapsed ? PANEL_H_COLLAPSED : PANEL_H_EXPANDED;
  const isDragging = dragPosition !== null;

  const settledPosition = useMemo(
    () => cornerToPosition(corner, panelHeight, canvasWidth, canvasHeight),
    [corner, panelHeight, canvasWidth, canvasHeight],
  );
  const renderPosition = dragPosition ?? settledPosition;

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ corner, collapsed }));
    } catch {
      // Minimap placement is a convenience; restricted storage should not break the canvas.
    }
  }, [corner, collapsed, storageKey]);

  const { dots, vx, vy, vw, vh, bbX1, bbY1, scale, offsetX, offsetY } = useMemo(() => {
    if (!hasNodes) {
      return {
        dots: [],
        vx: 0,
        vy: 0,
        vw: 0,
        vh: 0,
        bbX1: 0,
        bbY1: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      };
    }

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
  }, [nodes, transform, canvasWidth, canvasHeight, dotColors, hasNodes]);

  if (!hasNodes) return null;

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

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const panel = panelRef.current;
    const container = panel?.offsetParent;
    if (!panel || !(container instanceof HTMLElement)) return;

    const panelRect = panel.getBoundingClientRect();
    // Cache the container rect once up front — reading it on every
    // pointermove forces a synchronous layout recalculation on a canvas that
    // can have hundreds of SVG nodes.
    const containerRect = container.getBoundingClientRect();
    const start = clampToCanvas(
      { x: panelRect.left - containerRect.left, y: panelRect.top - containerRect.top },
      panelHeight,
      canvasWidth,
      canvasHeight,
    );

    dragRef.current = {
      pointerId: e.pointerId,
      containerRect,
      dx: e.clientX - panelRect.left,
      dy: e.clientY - panelRect.top,
      lastPosition: start,
    };
    setDragPosition(start);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const updateDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = clampToCanvas(
      { x: e.clientX - drag.containerRect.left - drag.dx, y: e.clientY - drag.containerRect.top - drag.dy },
      panelHeight,
      canvasWidth,
      canvasHeight,
    );
    drag.lastPosition = next;
    setDragPosition(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // Snap to whichever corner the panel was dropped closest to — the CSS
    // transition on left/top (enabled once dragPosition clears) animates the
    // settle, so it reads as a deliberate "snap" rather than a jump.
    setCorner(nearestCorner(drag.lastPosition, panelHeight, canvasWidth, canvasHeight));
    setDragPosition(null);
  };

  return (
    <div
      ref={panelRef}
      className="absolute overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/94 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
      style={{
        width: MINIMAP_W,
        left: renderPosition.x,
        top: renderPosition.y,
        transition: isDragging ? 'none' : `left ${SNAP_DURATION_MS}ms ease-out, top ${SNAP_DURATION_MS}ms ease-out`,
      }}
    >
      <div
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'flex w-full cursor-grab touch-none select-none items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]/60 active:cursor-grabbing',
          !collapsed && 'border-b border-[var(--border)]',
        )}
        title="Drag to move — snaps to the nearest corner"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed((value) => !value)}
            className="shrink-0 rounded-md p-0.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
            title={collapsed ? 'Expand minimap' : 'Collapse minimap'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Minimap</p>
            {!collapsed && <p className="truncate text-[11px] text-[var(--text-2)]">Click to recenter</p>}
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
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
              <Maximize2 size={14} />
            </button>
            <button
              onClick={onAutoLayout}
              disabled={disableAutoLayout || !onAutoLayout}
              className={cn(
                "flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 text-[var(--text-2)] transition-colors",
                disableAutoLayout || !onAutoLayout
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
              )}
              title="Auto-layout"
            >
              <Wand2 size={14} />
            </button>
            <button
              onClick={onZoomIn}
              className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
              title="Zoom in"
            >
              <Plus size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
