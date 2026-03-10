import { useMemo } from 'react';
import type { LandscapeProblem, LandscapeState } from '@/types/problem';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { evaluateLandscape } from '@/problems/local-search/landscape';
import { CandidateList, SummaryCards, TraceNotes } from './LocalSearchShared';

interface LandscapeLabProps {
  problem: LandscapeProblem;
  step: LocalSearchStep | null;
}

function LandscapeSurface({ problem, current, best }: { problem: LandscapeProblem; current: LandscapeState; best: LandscapeState }) {
  const width = 520;
  const height = 360;
  const xRange = problem.xRange ?? [-4, 4];
  const yRange = problem.yRange ?? [-4, 4];
  const resolution = 28;
  const cells = useMemo(() => {
    const samples: Array<{ x: number; y: number; value: number }> = [];
    for (let row = 0; row < resolution; row++) {
      for (let col = 0; col < resolution; col++) {
        const x = xRange[0] + (col / (resolution - 1)) * (xRange[1] - xRange[0]);
        const y = yRange[0] + (row / (resolution - 1)) * (yRange[1] - yRange[0]);
        samples.push({ x, y, value: evaluateLandscape(problem, { x, y }) });
      }
    }
    return samples;
  }, [problem, xRange, yRange]);
  const minValue = Math.min(...cells.map(cell => cell.value));
  const maxValue = Math.max(...cells.map(cell => cell.value));
  const color = (value: number) => {
    const ratio = (value - minValue) / Math.max(maxValue - minValue, 1e-6);
    const red = Math.round(40 + ratio * 180);
    const green = Math.round(80 + ratio * 140);
    const blue = Math.round(120 - ratio * 70);
    return `rgb(${red}, ${green}, ${blue})`;
  };
  const scaleX = (x: number) => ((x - xRange[0]) / (xRange[1] - xRange[0])) * width;
  const scaleY = (y: number) => height - ((y - yRange[0]) / (yRange[1] - yRange[0])) * height;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-xl border border-[var(--border)] bg-[#0d151f]">
        {cells.map((cell, index) => (
          <rect
            key={index}
            x={scaleX(cell.x) - width / resolution / 2}
            y={scaleY(cell.y) - height / resolution / 2}
            width={width / resolution + 1}
            height={height / resolution + 1}
            fill={color(cell.value)}
            opacity="0.85"
          />
        ))}
        <circle cx={scaleX(best.x)} cy={scaleY(best.y)} r="9" fill="#53C880" stroke="#0b1220" strokeWidth="3" />
        <circle cx={scaleX(current.x)} cy={scaleY(current.y)} r="9" fill="#F2C94C" stroke="#0b1220" strokeWidth="3" />
      </svg>
    </div>
  );
}

export function LandscapeBoardTab({ problem, step }: LandscapeLabProps) {
  const current = (step?.state.currentState as LandscapeState | undefined) ?? problem.initialState ?? { x: 0, y: 0 };
  const best = (step?.state.bestState as LandscapeState | undefined) ?? current;
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <SummaryCards step={step} />
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,0.95fr)]">
          <section>
            <LandscapeSurface problem={problem} current={current} best={best} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Surface</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">State Space Geometry</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                The yellow marker is the current point; the green marker is the best point seen so far. This lab makes ridges, peaks, and local basins visible directly.
              </p>
            </div>
            <TraceNotes step={step} fallback="Landscape Lab makes the objective surface itself visible, which is ideal for explaining annealing, beam behavior, and local maxima." />
          </section>
        </div>
      </div>
    </div>
  );
}

export function LandscapeNeighborhoodTab({ problem, step }: LandscapeLabProps) {
  const current = (step?.state.currentState as LandscapeState | undefined) ?? problem.initialState ?? { x: 0, y: 0 };
  const best = (step?.state.bestState as LandscapeState | undefined) ?? current;
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(320px,1.2fr)]">
          <section>
            <LandscapeSurface problem={problem} current={current} best={best} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Neighborhood</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Local Steps</h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Neighboring moves are small geometric steps in the plane. This is the cleanest lab for understanding why greedy ascent stalls and why temperature or memory can matter.
              </p>
            </div>
            <CandidateList
              candidates={step?.state.candidateMoves ?? []}
              acceptedMove={step?.state.acceptedMove ?? null}
              objectiveLabel={step?.state.objectiveLabel ?? 'Elevation'}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
