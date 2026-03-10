import { cn } from '@/lib/cn';
import type { GraphColoringProblem } from '@/types/problem';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { CandidateList, SummaryCards, TraceNotes } from './LocalSearchShared';
import { normalizeGraphNodes } from '@/problems/local-search/graph-coloring';

interface GraphColoringLabProps {
  problem: GraphColoringProblem;
  step: LocalSearchStep | null;
  onCycleNode: (index: number) => void;
}

const PALETTE = ['#F2C94C', '#58A6FF', '#53C880', '#FF7B72', '#D2A8FF', '#56D4DD', '#FFA657', '#7EE787'];

function ColoringCanvas({ problem, colors, onCycleNode }: { problem: GraphColoringProblem; colors: number[]; onCycleNode: (index: number) => void }) {
  const nodes = normalizeGraphNodes(problem);
  const conflictCounts = (colors.length > 0 ? (nodes.map(() => 0)) : []);
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  for (const edge of problem.graph.edges) {
    const left = nodeIndex.get(edge.source);
    const right = nodeIndex.get(edge.target);
    if (left == null || right == null) continue;
    if (colors[left] === colors[right]) {
      conflictCounts[left]++;
      conflictCounts[right]++;
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
      <svg viewBox="-240 -240 480 480" className="w-full overflow-visible rounded-xl border border-[var(--border)] bg-[#0d151f]">
        {problem.graph.edges.map(edge => {
          const source = nodes[nodeIndex.get(edge.source) ?? 0];
          const target = nodes[nodeIndex.get(edge.target) ?? 0];
          const isConflict = colors[nodeIndex.get(edge.source) ?? 0] === colors[nodeIndex.get(edge.target) ?? 0];
          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isConflict ? '#FF7B72' : 'rgba(255,255,255,0.18)'}
              strokeWidth={isConflict ? 4 : 2}
            />
          );
        })}

        {nodes.map((node, index) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onClick={() => onCycleNode(index)} className="cursor-pointer">
            <circle
              r="20"
              fill={PALETTE[colors[index] % PALETTE.length] ?? '#58A6FF'}
              stroke={conflictCounts[index] > 0 ? '#FF7B72' : '#0b1220'}
              strokeWidth="3"
            />
            <text y="4" textAnchor="middle" fontSize="10" fill="#0b1220" fontWeight="700">
              {node.label ?? node.id}
            </text>
            {conflictCounts[index] > 0 && (
              <text y="30" textAnchor="middle" fontSize="10" fill="#FF7B72">
                {`c=${conflictCounts[index]}`}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function GraphColoringBoardTab({ problem, step, onCycleNode }: GraphColoringLabProps) {
  const colors = (step?.state.currentState as number[] | undefined) ?? problem.initialColors ?? Array.from({ length: problem.graph.nodes.length }, (_, index) => index % problem.colorCount);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <SummaryCards step={step} />
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,0.95fr)]">
          <section>
            <ColoringCanvas problem={problem} colors={colors} onCycleNode={onCycleNode} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Assignment</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Current Coloring</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                {step?.state.currentSummary ?? 'Click nodes to cycle colors while you set up a graph-coloring instance.'}
              </p>
            </div>
            <TraceNotes step={step} fallback="Graph coloring is a CSP-style local-search lab: neighboring states recolor one node, and the objective is to eliminate conflicting edges." />
          </section>
        </div>
      </div>
    </div>
  );
}

export function GraphColoringNeighborhoodTab({ problem, step, onCycleNode }: GraphColoringLabProps) {
  const colors = (step?.state.currentState as number[] | undefined) ?? problem.initialColors ?? Array.from({ length: problem.graph.nodes.length }, (_, index) => index % problem.colorCount);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.75fr)_minmax(320px,1.25fr)]">
          <section>
            <ColoringCanvas problem={problem} colors={colors} onCycleNode={onCycleNode} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Neighborhood</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Recoloring Moves</h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Each neighbor changes the color of exactly one node. Conflicting edges are highlighted in red so you can see why repair-based algorithms work well here.
              </p>
            </div>
            <CandidateList
              candidates={step?.state.candidateMoves ?? []}
              acceptedMove={step?.state.acceptedMove ?? null}
              objectiveLabel={step?.state.objectiveLabel ?? 'Conflicting Edges'}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
