import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home, Search, SplitSquareVertical } from 'lucide-react';
import CellularAutomatonBackdrop from '@/components/visualization/CellularAutomatonBackdrop';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      <div className="relative min-h-full overflow-hidden rounded-xl border border-[var(--border)] ide-surface">
        <div className="absolute inset-0 overflow-hidden opacity-[0.38] blur-[0.5px] pointer-events-none">
          <CellularAutomatonBackdrop intervalMs={50} changeRuleIntervalMs={10000} cellSize={10} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,179,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(83,200,128,0.12),transparent_28%)]" />

        <div className="relative z-10 grid min-h-full grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <section className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)]/72 p-6 backdrop-blur-[5px] sm:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Error / 404
                </span>
                <span className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--accent)]">
                  Route Unresolved
                </span>
              </div>

              <div className="space-y-4">
                <span className="font-bold text-4xl tracking-tight text-[var(--text)] font-mono sm:text-5xl">
                  Praxis
                </span>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-5xl">
                    The requested view is outside the current search space.
                  </h1>
                  <p className="max-w-xl text-sm leading-6 text-[var(--text-2)] sm:text-base">
                    Praxis couldn&apos;t resolve this route. The page may have moved, the URL may be incomplete, or the module was never registered in the first place.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/45 p-4">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
                  <SplitSquareVertical size={14} />
                  Failed Route
                </div>
                <code className="mt-3 block overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--titlebar)] px-4 py-3 font-mono text-sm text-[var(--text)]">
                  {pathname}
                </code>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm font-mono uppercase tracking-[0.18em] text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
              >
                <ArrowLeft size={16} />
                Go Back
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-mono font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-transform hover:scale-[1.01]"
              >
                <Home size={16} />
                Return Home
              </Link>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/78 p-5 backdrop-blur-[5px]">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
                Recovery Options
              </p>
              <div className="mt-4 grid gap-3">
                <Link
                  to="/"
                  className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 p-4 transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--accent)]">
                      <Compass size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">Open taxonomy</p>
                      <p className="mt-1 text-xs text-[var(--text-2)]">Browse the full algorithm catalog from the home workspace.</p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/?tab=algorithms"
                  className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 p-4 transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--success)]">
                      <Search size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">Search modules</p>
                      <p className="mt-1 text-xs text-[var(--text-2)]">Use the homepage search to jump back into a registered algorithm or lab.</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/78 p-5 backdrop-blur-[5px]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
                  Route Diagnostics
                </p>
                <span className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">
                  Unreachable
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 p-4">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
                  <span>Resolver status</span>
                  <span>3 checks</span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">Route lookup</p>
                      <p className="mt-1 text-xs text-[var(--text-2)]">No registered page matched the current path.</p>
                    </div>
                    <span className="rounded-md border border-[var(--danger)]/30 bg-[rgba(255,127,127,0.12)] px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--danger)]">
                      Failed
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">Suggested fallback</p>
                      <p className="mt-1 text-xs text-[var(--text-2)]">Return to taxonomy or search for a valid module entry point.</p>
                    </div>
                    <span className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--accent)]">
                      Ready
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">Current path</p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--text-2)]">{pathname}</p>
                    </div>
                    <span className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">
                      Captured
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
