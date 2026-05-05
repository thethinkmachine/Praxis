import type { TspProblem } from '@/types/problem';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { CandidateList, SummaryCards, TraceNotes } from './LocalSearchShared';
import SurfaceCard from '@/components/shared/SurfaceCard';

interface TspLabProps {
  problem: TspProblem;
  step: LocalSearchStep | null;
  onRegenerate: () => void;
  onUpdateCities?: (cities: TspProblem['cities']) => void;
}

export function TspMiniature({ problem, route }: { problem: TspProblem; route: number[] }) {
  const cities = route.map(index => problem.cities[index]);
  const width = 64;
  const height = 64;
  const minX = Math.min(...problem.cities.map(city => city.x));
  const maxX = Math.max(...problem.cities.map(city => city.x));
  const minY = Math.min(...problem.cities.map(city => city.y));
  const maxY = Math.max(...problem.cities.map(city => city.y));
  const scaleX = (x: number) => 8 + ((x - minX) / Math.max(maxX - minX, 1)) * (width - 16);
  const scaleY = (y: number) => 8 + ((y - minY) / Math.max(maxY - minY, 1)) * (height - 16);

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-0.5 overflow-hidden w-[64px] h-[64px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {cities.map((city, index) => {
          const next = cities[(index + 1) % cities.length];
          return (
            <line
              key={`${city.id}-${next.id}`}
              x1={scaleX(city.x)}
              y1={scaleY(city.y)}
              x2={scaleX(next.x)}
              y2={scaleY(next.y)}
              stroke="rgba(83,200,128,0.72)"
              strokeWidth="1.5"
            />
          );
        })}
        {problem.cities.map(city => (
          <circle key={city.id} cx={scaleX(city.x)} cy={scaleY(city.y)} r="2" fill="#F2C94C" />
        ))}
      </svg>
    </div>
  );
}

function RouteCanvas({
  problem,
  route,
  onUpdateCities,
}: {
  problem: TspProblem;
  route: number[];
  onUpdateCities?: (cities: TspProblem['cities']) => void;
}) {
  const cities = route.map(index => problem.cities[index]);
  const width = 520;
  const height = 360;
  const minX = Math.min(...problem.cities.map(city => city.x));
  const maxX = Math.max(...problem.cities.map(city => city.x));
  const minY = Math.min(...problem.cities.map(city => city.y));
  const maxY = Math.max(...problem.cities.map(city => city.y));
  const scaleX = (x: number) => 40 + ((x - minX) / Math.max(maxX - minX, 1)) * (width - 80);
  const scaleY = (y: number) => 40 + ((y - minY) / Math.max(maxY - minY, 1)) * (height - 80);

  return (
    <SurfaceCard tone="muted" className="rounded-2xl">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]"
        onPointerMove={(e) => {
          if (!onUpdateCities || e.buttons !== 1) return;
          const target = e.target as SVGElement;
          const cityIdAttr = target.closest('g')?.getAttribute('data-city-id');
          if (!cityIdAttr) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width * width;
          const y = (e.clientY - rect.top) / rect.height * height;

          // Inverse scaling
          const realX = minX + ((x - 40) / (width - 80)) * (maxX - minX);
          const realY = minY + ((y - 40) / (height - 80)) * (maxY - minY);

          const nextCities = problem.cities.map(c => 
            c.id === cityIdAttr ? { ...c, x: realX, y: realY } : c
          );
          onUpdateCities(nextCities);
        }}
      >
        {cities.map((city, index) => {
          const next = cities[(index + 1) % cities.length];
          return (
            <line
              key={`${city.id}-${next.id}`}
              x1={scaleX(city.x)}
              y1={scaleY(city.y)}
              x2={scaleX(next.x)}
              y2={scaleY(next.y)}
              stroke="rgba(83,200,128,0.72)"
              strokeWidth="3"
              className="pointer-events-none"
            />
          );
        })}
        {problem.cities.map(city => (
          <g key={city.id} data-city-id={city.id} className={onUpdateCities ? 'cursor-move' : ''}>
            <circle cx={scaleX(city.x)} cy={scaleY(city.y)} r="12" fill="#F2C94C" stroke="var(--bg)" strokeWidth="2.5" />
            <text x={scaleX(city.x)} y={scaleY(city.y) + 4} textAnchor="middle" fontSize="10" fill="var(--bg)" fontWeight="700" className="pointer-events-none">
              {city.label ?? city.id}
            </text>
          </g>
        ))}
      </svg>
    </SurfaceCard>
  );
}

export function TspBoardTab({ problem, step, onRegenerate, onUpdateCities }: TspLabProps) {
  const route = (step?.state.currentState as number[] | undefined) ?? problem.initialRoute ?? Array.from({ length: problem.cities.length }, (_, index) => index);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <SummaryCards step={step} />
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,0.95fr)]">
          <section className="space-y-4">
            <RouteCanvas problem={problem} route={route} />
            <button onClick={onRegenerate} className="ui-btn w-full justify-center rounded-xl px-3 py-2 text-sm">
              Regenerate City Layout
            </button>
          </section>
          <section className="space-y-4">
            <SurfaceCard tone="muted" className="rounded-2xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Tour Summary</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Current Route</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                {step?.state.currentSummary ?? 'Run the algorithm to inspect the active tour.'}
              </p>
            </SurfaceCard>
            <TraceNotes step={step} fallback="TSP local search improves a tour by editing the visiting order rather than growing a path from a start node." />
          </section>
        </div>
      </div>
    </div>
  );
}

export function TspNeighborhoodTab({ problem, step, onRegenerate, onUpdateCities }: TspLabProps) {
  const route = (step?.state.currentState as number[] | undefined) ?? problem.initialRoute ?? Array.from({ length: problem.cities.length }, (_, index) => index);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.75fr)_minmax(320px,1.25fr)]">
          <section className="space-y-4">
            <RouteCanvas problem={problem} route={route} />
            <button onClick={onRegenerate} className="ui-btn w-full justify-center rounded-xl px-3 py-2 text-sm">
              Regenerate City Layout
            </button>
          </section>
          <section className="space-y-4">
            <SurfaceCard tone="muted" className="rounded-2xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Neighborhood</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Route Edits</h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                The neighborhood operator controls whether the route is modified by swapping cities, reversing a segment, or inserting one city elsewhere.
              </p>
            </SurfaceCard>
            <CandidateList
              candidates={step?.state.candidateMoves ?? []}
              acceptedMove={step?.state.acceptedMove ?? null}
              objectiveLabel={step?.state.objectiveLabel ?? 'Tour Length'}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
