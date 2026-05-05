import { useMemo } from 'react';
import type { PlanningGraphLayerView } from '@/algorithms/planning/types';

/* ── Layout tokens ─────────────────────────────────────────── */
const COL_WIDTH = 152;
const COL_GAP = 32;
const NODE_H = 24;
const NODE_GAP = 5;
const PAD = { x: 20, y: 48 };
const HEADER_H = 30;
const MUTEX_CURVE = 18;
const NOOP_PREFIX = 'NoOp(';

/* ── Palette ───────────────────────────────────────────────── */
const PALETTE = {
  propFill: 'var(--surface)',
  propStroke: '#58a6ff',
  actionFill: 'var(--surface)',
  actionStroke: '#d29922',
  noopStroke: '#484f58',
  goalFill: 'rgba(63,185,80,0.18)',
  goalStroke: '#3fb950',
  mutexStroke: '#f85149',
  extractFill: 'var(--accent-soft)',
  extractStroke: '#79c0ff',
  colBg: 'var(--surface-2)',
  headerText: 'var(--text-3)',
  nodeText: 'var(--text)',
  dimText: 'var(--text-3)',
  connector: 'rgba(110,118,129,0.25)',
};

/* ── Helpers ───────────────────────────────────────────────── */

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'proposition' | 'action' | 'noop';
  highlighted: boolean;
  isGoal: boolean;
  isMutex: boolean;
}

interface LayoutColumn {
  x: number;
  headerLabel: string;
  subLabel: string;
  nodes: LayoutNode[];
  mutexPairs: Array<[number, number]>;
  columnType: 'proposition' | 'action';
}

function isNoop(label: string): boolean {
  return label.startsWith(NOOP_PREFIX);
}

function parseMutexPair(entry: string): [string, string] | null {
  const parts = entry.split(' <> ');
  if (parts.length !== 2) return null;
  return [parts[0].trim(), parts[1].trim()];
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

function buildLayout(
  layers: PlanningGraphLayerView[],
  goalLiterals: string[],
  extractedActions: Set<string>,
): { columns: LayoutColumn[]; totalWidth: number; totalHeight: number } {
  const goalSet = new Set(goalLiterals);
  const columns: LayoutColumn[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const colX = columns.length * (COL_WIDTH + COL_GAP) + PAD.x;

    /* Proposition column */
    const propMutexLabels = new Set<string>();
    for (const m of layer.propositionMutex) {
      const pair = parseMutexPair(m);
      if (pair) { propMutexLabels.add(pair[0]); propMutexLabels.add(pair[1]); }
    }

    const propNodes: LayoutNode[] = layer.propositions.map((p, idx) => ({
      id: `p${i}-${p}`,
      label: p,
      x: colX,
      y: PAD.y + HEADER_H + idx * (NODE_H + NODE_GAP),
      w: COL_WIDTH,
      h: NODE_H,
      type: 'proposition',
      highlighted: false,
      isGoal: goalSet.has(p),
      isMutex: propMutexLabels.has(p),
    }));

    const propMutexPairs: Array<[number, number]> = [];
    for (const m of layer.propositionMutex) {
      const pair = parseMutexPair(m);
      if (!pair) continue;
      const idxA = layer.propositions.indexOf(pair[0]);
      const idxB = layer.propositions.indexOf(pair[1]);
      if (idxA >= 0 && idxB >= 0) propMutexPairs.push([idxA, idxB]);
    }

    columns.push({
      x: colX,
      headerLabel: `P${i}`,
      subLabel: `${layer.propositions.length} prop${layer.propositions.length !== 1 ? 's' : ''}`,
      nodes: propNodes,
      mutexPairs: propMutexPairs,
      columnType: 'proposition',
    });

    /* Action column (skip level 0 which has no actions) */
    if (layer.actions.length > 0) {
      const actColX = columns.length * (COL_WIDTH + COL_GAP) + PAD.x;
      const realActions = layer.actions.filter(a => !isNoop(a));
      const noopCount = layer.actions.length - realActions.length;

      const actMutexLabels = new Set<string>();
      for (const m of layer.actionMutex) {
        const pair = parseMutexPair(m);
        if (pair) { actMutexLabels.add(pair[0]); actMutexLabels.add(pair[1]); }
      }

      const actNodes: LayoutNode[] = realActions.map((a, idx) => ({
        id: `a${i}-${a}`,
        label: a,
        x: actColX,
        y: PAD.y + HEADER_H + idx * (NODE_H + NODE_GAP),
        w: COL_WIDTH,
        h: NODE_H,
        type: 'action',
        highlighted: extractedActions.has(a),
        isGoal: false,
        isMutex: actMutexLabels.has(a),
      }));

      /* Noop summary node */
      if (noopCount > 0) {
        actNodes.push({
          id: `noop-summary-${i}`,
          label: `+ ${noopCount} persistence`,
          x: actColX,
          y: PAD.y + HEADER_H + realActions.length * (NODE_H + NODE_GAP),
          w: COL_WIDTH,
          h: NODE_H,
          type: 'noop',
          highlighted: false,
          isGoal: false,
          isMutex: false,
        });
      }

      const actMutexPairs: Array<[number, number]> = [];
      for (const m of layer.actionMutex) {
        const pair = parseMutexPair(m);
        if (!pair) continue;
        const idxA = realActions.indexOf(pair[0]);
        const idxB = realActions.indexOf(pair[1]);
        if (idxA >= 0 && idxB >= 0) actMutexPairs.push([idxA, idxB]);
      }

      columns.push({
        x: actColX,
        headerLabel: `A${i}`,
        subLabel: `${realActions.length} action${realActions.length !== 1 ? 's' : ''}`,
        nodes: actNodes,
        mutexPairs: actMutexPairs,
        columnType: 'action',
      });
    }
  }

  const maxNodesInCol = Math.max(1, ...columns.map(c => c.nodes.length));
  const totalWidth = columns.length * (COL_WIDTH + COL_GAP) + PAD.x * 2;
  const totalHeight = PAD.y + HEADER_H + maxNodesInCol * (NODE_H + NODE_GAP) + PAD.y;

  return { columns, totalWidth, totalHeight };
}

/* ── Component ─────────────────────────────────────────────── */

interface PlanningGraphVisualizerProps {
  layers: PlanningGraphLayerView[];
  extractedPlan?: string[][];
  goalLiterals?: string[];
  focusLevel?: number | null;
}

export default function PlanningGraphVisualizer({
  layers,
  extractedPlan = [],
  goalLiterals = [],
  focusLevel,
}: PlanningGraphVisualizerProps) {
  const extractedActions = useMemo(() => {
    const set = new Set<string>();
    for (const level of extractedPlan) {
      for (const action of level) set.add(action);
    }
    return set;
  }, [extractedPlan]);

  const { columns, totalWidth, totalHeight } = useMemo(
    () => buildLayout(layers, goalLiterals, extractedActions),
    [layers, goalLiterals, extractedActions],
  );

  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-8">
        <p className="text-sm italic text-[var(--text-3)]">
          Run the algorithm to see the planning graph grow level by level.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]/40">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="block"
        style={{ minWidth: totalWidth }}
      >
        <defs>
          <filter id="pg-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="pg-prop-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.propStroke} stopOpacity={0.12} />
            <stop offset="100%" stopColor={PALETTE.propStroke} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="pg-act-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.actionStroke} stopOpacity={0.12} />
            <stop offset="100%" stopColor={PALETTE.actionStroke} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        {/* Column backgrounds */}
        {columns.map((col, ci) => {
          const colH = totalHeight - PAD.y * 2;
          const isFocused = focusLevel !== null && focusLevel !== undefined &&
            ((col.columnType === 'proposition' && col.headerLabel === `P${focusLevel}`) ||
             (col.columnType === 'action' && col.headerLabel === `A${focusLevel}`));
          return (
            <g key={`col-bg-${ci}`}>
              <rect
                x={col.x - 4}
                y={PAD.y - 8}
                width={COL_WIDTH + 8}
                height={colH + 16}
                rx={12}
                fill={col.columnType === 'proposition' ? 'url(#pg-prop-grad)' : 'url(#pg-act-grad)'}
                stroke={isFocused ? (col.columnType === 'proposition' ? PALETTE.propStroke : PALETTE.actionStroke) : PALETTE.connector}
                strokeWidth={isFocused ? 1.5 : 0.5}
                strokeDasharray={isFocused ? 'none' : '4 3'}
                opacity={isFocused ? 1 : 0.7}
              />
              {/* Column header */}
              <text
                x={col.x + COL_WIDTH / 2}
                y={PAD.y + 4}
                textAnchor="middle"
                fill={col.columnType === 'proposition' ? PALETTE.propStroke : PALETTE.actionStroke}
                fontSize={13}
                fontWeight={700}
                fontFamily="var(--font-mono, monospace)"
              >
                {col.headerLabel}
              </text>
              <text
                x={col.x + COL_WIDTH / 2}
                y={PAD.y + 18}
                textAnchor="middle"
                fill={PALETTE.dimText}
                fontSize={9}
                fontFamily="var(--font-mono, monospace)"
              >
                {col.subLabel}
              </text>
            </g>
          );
        })}

        {/* Connector arrows between columns */}
        {columns.slice(0, -1).map((col, ci) => {
          const x1 = col.x + COL_WIDTH + 2;
          const x2 = columns[ci + 1].x - 2;
          const midY = PAD.y + HEADER_H + 8;
          return (
            <g key={`conn-${ci}`}>
              <line
                x1={x1} y1={midY} x2={x2} y2={midY}
                stroke={PALETTE.connector}
                strokeWidth={1.5}
                markerEnd="url(#pg-arrow)"
              />
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="pg-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke={PALETTE.connector} strokeWidth={1} />
          </marker>
        </defs>

        {/* Nodes */}
        {columns.map((col) =>
          col.nodes.map((node) => {
            let fill = PALETTE.propFill;
            let stroke = PALETTE.propStroke;

            if (node.type === 'action') {
              fill = node.highlighted ? PALETTE.extractFill : PALETTE.actionFill;
              stroke = node.highlighted ? PALETTE.extractStroke : PALETTE.actionStroke;
            } else if (node.type === 'noop') {
              fill = 'rgba(110,118,129,0.04)';
              stroke = PALETTE.noopStroke;
            } else if (node.isGoal) {
              fill = PALETTE.goalFill;
              stroke = PALETTE.goalStroke;
            }

            const rx = node.type === 'proposition' ? 12 : node.type === 'noop' ? 8 : 6;

            return (
              <g key={node.id}>
                {node.highlighted && (
                  <rect
                    x={node.x - 1}
                    y={node.y - 1}
                    width={node.w + 2}
                    height={node.h + 2}
                    rx={rx + 1}
                    fill="none"
                    stroke={PALETTE.extractStroke}
                    strokeWidth={2}
                    opacity={0.5}
                    filter="url(#pg-glow)"
                  />
                )}
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx={rx}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={node.isMutex ? 1.5 : 0.8}
                />
                {/* Goal indicator dot */}
                {node.isGoal && (
                  <circle
                    cx={node.x + 10}
                    cy={node.y + node.h / 2}
                    r={3}
                    fill={PALETTE.goalStroke}
                  />
                )}
                <text
                  x={node.x + (node.isGoal ? 18 : 8)}
                  y={node.y + node.h / 2 + 1}
                  dominantBaseline="middle"
                  fill={node.type === 'noop' ? PALETTE.dimText : PALETTE.nodeText}
                  fontSize={node.type === 'noop' ? 9 : 10}
                  fontFamily="var(--font-mono, monospace)"
                  fontStyle={node.type === 'noop' ? 'italic' : 'normal'}
                >
                  {truncateLabel(node.label, 18)}
                </text>
              </g>
            );
          }),
        )}

        {/* Mutex arcs */}
        {columns.map((col) =>
          col.mutexPairs.map(([idxA, idxB], mi) => {
            const nodeA = col.nodes[idxA];
            const nodeB = col.nodes[idxB];
            if (!nodeA || !nodeB) return null;
            const x = col.x + col.nodes[0].w + 6;
            const y1 = nodeA.y + NODE_H / 2;
            const y2 = nodeB.y + NODE_H / 2;
            const midY = (y1 + y2) / 2;
            const curveOffset = Math.min(MUTEX_CURVE, Math.abs(y2 - y1) * 0.3);
            return (
              <path
                key={`mutex-${col.headerLabel}-${mi}`}
                d={`M${x},${y1} C${x + curveOffset},${y1} ${x + curveOffset},${y2} ${x},${y2}`}
                fill="none"
                stroke={PALETTE.mutexStroke}
                strokeWidth={1}
                strokeDasharray="3 2"
                opacity={0.6}
              />
            );
          }),
        )}

        {/* Legend */}
        <g transform={`translate(${PAD.x}, ${totalHeight - 22})`}>
          <circle cx={4} cy={0} r={3} fill={PALETTE.propStroke} />
          <text x={12} y={3} fill={PALETTE.dimText} fontSize={8} fontFamily="var(--font-mono, monospace)">Prop</text>
          <rect x={50} y={-4} width={8} height={8} rx={2} fill={PALETTE.actionStroke} />
          <text x={62} y={3} fill={PALETTE.dimText} fontSize={8} fontFamily="var(--font-mono, monospace)">Action</text>
          <circle cx={110} cy={0} r={3} fill={PALETTE.goalStroke} />
          <text x={118} y={3} fill={PALETTE.dimText} fontSize={8} fontFamily="var(--font-mono, monospace)">Goal</text>
          <line x1={158} y1={0} x2={174} y2={0} stroke={PALETTE.mutexStroke} strokeWidth={1} strokeDasharray="3 2" />
          <text x={178} y={3} fill={PALETTE.dimText} fontSize={8} fontFamily="var(--font-mono, monospace)">Mutex</text>
          {extractedPlan.length > 0 && (
            <>
              <rect x={218} y={-4} width={8} height={8} rx={2} fill={PALETTE.extractFill} stroke={PALETTE.extractStroke} strokeWidth={1} />
              <text x={230} y={3} fill={PALETTE.dimText} fontSize={8} fontFamily="var(--font-mono, monospace)">Extracted</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
