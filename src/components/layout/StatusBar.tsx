import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { usePreferencesStore } from '@/store/preferences.store';
import { useExecutionStore } from '@/store/execution.store';
import { Terminal, ChevronUp, AlertTriangle } from '@/components/shared/Icons';
import type { MetricTile, StepMetrics, StepPhase } from '@/types';

/** Crawl speed for overflowing banner text, in px/sec. */
const MARQUEE_SPEED = 50;
const MARQUEE_GAP_PX = 48;
const MARQUEE_MIN_DURATION = 6;

/** Single-line text that truncates normally, but crawls (marquee-scrolls)
 *  instead of ellipsizing once it's too long for its container — used for
 *  load errors/warnings, which can be long free-form validation messages. */
function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const overflowing = textEl.scrollWidth > container.clientWidth;
      setDuration(overflowing ? Math.max(MARQUEE_MIN_DURATION, (textEl.scrollWidth + MARQUEE_GAP_PX) / MARQUEE_SPEED) : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  if (duration === null) {
    return (
      <div ref={containerRef} className={cn('truncate', className)}>
        <span ref={textRef}>{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('overflow-hidden whitespace-nowrap', className)}>
      <div className="inline-flex animate-marquee" style={{ animationDuration: `${duration}s` }}>
        <span ref={textRef} className="pr-12">{text}</span>
        <span className="pr-12" aria-hidden="true">{text}</span>
      </div>
    </div>
  );
}

/** Coarse run state shown by the leading status dot — richer than a simple
 *  isPlaying/idle split so load failures and a completed-but-failed search
 *  read distinctly instead of collapsing into a generic "Idle"/"Finished". */
type RunState = 'ready' | 'error' | 'running' | 'paused' | 'finished' | 'failed';

const RUN_STATE_LABEL: Record<RunState, string> = {
  ready: 'Ready',
  error: 'Error',
  running: 'Running',
  paused: 'Paused',
  finished: 'Finished',
  failed: 'Failed',
};

const RUN_STATE_DOT: Record<RunState, string> = {
  ready: 'bg-[var(--text-3)]',
  error: 'bg-[var(--danger)]',
  running: 'bg-[var(--success)] animate-pulse',
  paused: 'bg-[var(--warning)]',
  finished: 'bg-[var(--accent)]',
  failed: 'bg-[var(--danger)]',
};

// Mirrors the phase→tone mapping used in StateMetricsPanel so the same
// algorithm phase always reads the same color across the app.
const PHASE_PILL_VARIANT: Partial<Record<StepPhase, string>> = {
  expanding: 'ui-pill-warning',
  visiting: 'ui-pill-warning',
  propagating: 'ui-pill-warning',
  found: 'ui-pill-success',
  failed: 'ui-pill-danger',
};

/** Every algorithm family emits `metrics` as an ordered MetricTile[] today —
 *  the StepMetrics object shape is legacy. Normalizing here (rather than
 *  hardcoding label lookups like "Frontier"/"Expanded") means the bar shows
 *  whichever metrics an algorithm actually reports, so CSP/planning/local-search
 *  runs surface real numbers instead of a permanent "-". */
function normalizeMetricTiles(metrics: StepMetrics | MetricTile[]): MetricTile[] {
  if (Array.isArray(metrics)) return metrics;
  return Object.entries(metrics)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      value: value as number | string,
    }));
}

function Divider({ className }: { className?: string }) {
  return <div className={cn('w-px h-3 bg-[var(--border-strong)] shrink-0', className)} />;
}

function LatestLogDisplay() {
  const lastLog = useExecutionStore((s) => (s.logs.length > 0 ? s.logs[s.logs.length - 1] : null));

  if (!lastLog) {
    return <span className="opacity-40 italic">No output yet</span>;
  }

  return (
    <span
      className={cn(
        'opacity-90',
        lastLog.level === 'success' && 'text-[var(--success)]',
        lastLog.level === 'warn' && 'text-[var(--warning)]',
        lastLog.level === 'error' && 'text-[var(--danger)]',
      )}
    >
      <span className="opacity-50 mr-2">
        [{new Date(lastLog.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}]
      </span>
      {lastLog.message}
    </span>
  );
}

interface StatusBarProps {
  /** Whether the current route belongs to an algorithm/lab family (search,
   *  play, local, maze, planning, csp). Outside those routes the execution
   *  store still holds the previous run's step/logs (nothing clears it on
   *  navigation), so the bar deliberately stops surfacing that leftover
   *  telemetry rather than showing a stale trace on e.g. the home page. */
  isAlgoRoute: boolean;
}

export default function StatusBar({ isAlgoRoute }: StatusBarProps) {
  const terminalExpanded = usePreferencesStore((s) => s.terminalExpanded);
  const toggle = usePreferencesStore((s) => s.toggle);

  const isPlaying = useExecutionStore((s) => s.isPlaying);
  const currentIndex = useExecutionStore((s) => s.currentIndex);
  const totalSteps = useExecutionStore((s) => s.totalSteps);
  const step = useExecutionStore((s) => s.currentStep);
  const loadError = useExecutionStore((s) => s.loadError);
  const loadWarning = useExecutionStore((s) => s.loadWarning);
  const truncated = useExecutionStore((s) => s.truncated);
  const logs = useExecutionStore((s) => s.logs);

  const hasTrace = isAlgoRoute && totalSteps > 0;
  const isAtEnd = hasTrace && currentIndex >= totalSteps - 1;

  let runState: RunState = 'ready';
  if (isAlgoRoute) {
    if (loadError) runState = 'error';
    else if (!hasTrace) runState = 'ready';
    else if (isPlaying) runState = 'running';
    else if (isAtEnd) runState = step?.phase === 'failed' ? 'failed' : 'finished';
    else runState = 'paused';
  }

  const bannerMessage = isAlgoRoute ? (loadError ?? loadWarning) : null;
  const bannerTone = loadError ? 'text-[var(--danger)]' : 'text-[var(--warning)]';

  const metricTiles = hasTrace && step ? normalizeMetricTiles(step.metrics).slice(0, 2) : [];
  const issueCount = isAlgoRoute ? logs.filter((l) => l.level === 'warn' || l.level === 'error').length : 0;
  const phaseVariant = step ? PHASE_PILL_VARIANT[step.phase] : undefined;

  return (
    <footer className="ide-statusbar h-7 px-2.5 flex items-center gap-2.5 text-[10px] font-mono text-[var(--text-2)] shrink-0">
      {/* Run state */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('w-2 h-2 rounded-full', RUN_STATE_DOT[runState])} />
          <span className="uppercase tracking-wider font-medium">{RUN_STATE_LABEL[runState]}</span>
        </div>

        {isAlgoRoute && hasTrace && step && (
          <>
            <Divider />
            <span
              className={cn('ui-pill px-1.5 py-0.5 text-[9px] font-medium capitalize shrink-0', phaseVariant)}
              title={`Phase: ${step.phase}`}
            >
              {step.phase}
            </span>
          </>
        )}

        <Divider />

        <div className="flex-1 min-w-0">
          {bannerMessage ? (
            <MarqueeText text={bannerMessage} className={cn('font-medium', bannerTone)} />
          ) : isAlgoRoute ? (
            <div className="truncate"><LatestLogDisplay /></div>
          ) : (
            <span className="opacity-40 italic">Select an algorithm to begin</span>
          )}
        </div>
      </div>

      {/* Telemetry + utilities */}
      <div className="flex items-center gap-2.5 shrink-0">
        {isAlgoRoute && hasTrace && (
          <>
            {metricTiles.length > 0 && (
              <div className="hidden md:flex items-center gap-3">
                {metricTiles.map((tile) => (
                  <span key={tile.label} className="flex items-center gap-1 shrink-0" title={tile.label}>
                    <span className="text-[var(--text-3)]">{tile.label}</span>
                    <span className={cn('font-semibold', tile.color ?? 'text-[var(--text)]')}>{tile.value}</span>
                  </span>
                ))}
              </div>
            )}

            <span className="hidden sm:inline font-medium text-[var(--text)] shrink-0" title="Trace position">
              {currentIndex + 1}/{totalSteps}
            </span>

            {truncated && (
              <span
                className="ui-pill ui-pill-warning hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] shrink-0"
                title="Trace truncated at 50,000 steps"
              >
                <span className="w-1 h-1 rounded-full bg-[var(--warning)] animate-pulse" />
                Truncated
              </span>
            )}

            {issueCount > 0 && (
              <button
                onClick={() => toggle('terminalExpanded')}
                className="flex items-center gap-1 rounded px-1 shrink-0 text-[var(--warning)] hover:bg-[var(--surface-3)] transition-colors"
                title={`${issueCount} issue${issueCount === 1 ? '' : 's'} in output — click to view`}
              >
                <AlertTriangle size={10} />
                {issueCount}
              </button>
            )}

            <Divider />
          </>
        )}

        <button
          onClick={() => toggle('terminalExpanded')}
          aria-pressed={terminalExpanded}
          aria-label={terminalExpanded ? 'Hide output panel' : 'Show output panel'}
          title={terminalExpanded ? 'Hide output (`)' : 'Show output (`)'}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--surface-3)]',
            terminalExpanded && 'text-[var(--accent)]',
          )}
        >
          <Terminal size={11} />
          <span className="hidden sm:inline">Output</span>
          <ChevronUp size={10} className={cn('transition-transform duration-150', !terminalExpanded && 'rotate-180')} />
        </button>
      </div>
    </footer>
  );
}
