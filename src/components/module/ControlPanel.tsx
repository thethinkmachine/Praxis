import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';
import { useExecutionStore } from '@/store/execution.store';
import SpeedSlider from '@/components/controls/SpeedSlider';
import StepScrubber from '@/components/controls/StepScrubber';
import {
  SkipBack,
  StepBack,
  Play,
  Pause,
  StepForward,
  SkipForward,
} from '@/components/shared/Icons';

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Content
      sideOffset={6}
      className="z-50 px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[10px] text-[var(--text)] shadow-lg select-none"
    >
      {children}
      <Tooltip.Arrow className="fill-[var(--border)]" />
    </Tooltip.Content>
  );
}

const TRANSPORT_BTN = (enabled: boolean) =>
  cn(
    'w-7 h-7 flex items-center justify-center rounded-md transition-all duration-100',
    enabled
      ? 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] active:scale-90'
      : 'text-[var(--text-3)] cursor-not-allowed opacity-40',
  );

export default function ControlPanel() {
  const {
    currentIndex,
    totalSteps,
    isPlaying,
    speed,
    truncated,
    play,
    pause,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    seekToStep,
    setSpeed,
  } = useExecutionStore();

  const total = totalSteps;
  const canBack = currentIndex > 0;
  const canForward = currentIndex < total - 1;
  const hasTrace = total > 0;

  function handlePlayPause() {
    if (isPlaying) pause();
    else play();
  }

  return (
    <Tooltip.Provider delayDuration={400}>
      {/* Pulse animation injected once */}
      <style>{`
        @keyframes ctrl-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(88,166,255,0.35); }
          50%       { box-shadow: 0 0 0 6px rgba(88,166,255,0); }
        }
        .ctrl-play-pulse { animation: ctrl-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="h-full flex items-center gap-3 px-3 bg-[var(--surface)] border-t border-[var(--border)]">

        {/* ── Transport buttons ──────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 px-1 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] shrink-0">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button onClick={jumpToStart} disabled={!canBack} className={TRANSPORT_BTN(canBack)}>
                <SkipBack size={13} />
              </button>
            </Tooltip.Trigger>
            <Tip>Jump to start <kbd className="ml-1 opacity-50">Home</kbd></Tip>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button onClick={stepBackward} disabled={!canBack} className={TRANSPORT_BTN(canBack)}>
                <StepBack size={13} />
              </button>
            </Tooltip.Trigger>
            <Tip>Step back <kbd className="ml-1 opacity-50">←</kbd></Tip>
          </Tooltip.Root>

          {/* Play / Pause — focal button */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={handlePlayPause}
                disabled={!hasTrace}
                className={cn(
                  'w-9 h-9 mx-0.5 flex items-center justify-center rounded-full transition-all duration-150',
                  hasTrace
                    ? 'bg-[#58A6FF] text-[#0D1117] hover:bg-[#79C0FF] active:scale-90 shadow-[0_2px_12px_rgba(88,166,255,0.45)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-3)] cursor-not-allowed',
                  hasTrace && isPlaying && 'ctrl-play-pulse',
                )}
              >
                {isPlaying
                  ? <Pause size={16} />
                  : <Play size={16} className="ml-0.5" />
                }
              </button>
            </Tooltip.Trigger>
            <Tip>{isPlaying ? 'Pause' : 'Play'} <kbd className="ml-1 opacity-50">Space</kbd></Tip>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button onClick={stepForward} disabled={!canForward} className={TRANSPORT_BTN(canForward)}>
                <StepForward size={13} />
              </button>
            </Tooltip.Trigger>
            <Tip>Step forward <kbd className="ml-1 opacity-50">→</kbd></Tip>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button onClick={jumpToEnd} disabled={!canForward} className={TRANSPORT_BTN(canForward)}>
                <SkipForward size={13} />
              </button>
            </Tooltip.Trigger>
            <Tip>Jump to end <kbd className="ml-1 opacity-50">End</kbd></Tip>
          </Tooltip.Root>
        </div>

        {/* ── Scrubber ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <StepScrubber
            current={currentIndex}
            total={total}
            onChange={seekToStep}
            disabled={!hasTrace}
          />
        </div>

        {/* ── Step counter badge ─────────────────────────────────────── */}
        <span className="shrink-0 text-[10px] font-mono tabular-nums px-2 py-1 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)] leading-none">
          {hasTrace ? currentIndex + 1 : 0}
          <span className="text-[var(--text-3)] mx-0.5">/</span>
          {total}
        </span>

        {/* ── Truncated warning ──────────────────────────────────────── */}
        {truncated && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#F0883E]/10 text-[#F0883E] border border-[#F0883E]/25 whitespace-nowrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F0883E] animate-pulse" />
            Truncated
          </span>
        )}

        {/* ── Speed selector ─────────────────────────────────────────── */}
        {total > 10 && (
          <>
            <div className="w-px h-5 bg-[var(--border)] shrink-0" />
            <SpeedSlider value={speed} onChange={setSpeed} />
          </>
        )}
      </div>
    </Tooltip.Provider>
  );
}
