import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';
import { useExecutionStore } from '@/store/execution.store';
import StepScrubber from '@/components/controls/StepScrubber';
import {
  StepBack,
  Play,
  Pause,
  StepForward,
  SkipForward,
  Plus,
  Minus,
  RotateCcw,
} from '@/components/shared/Icons';

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Content
      sideOffset={6}
      className="z-50 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--text)] shadow-lg"
    >
      {children}
      <Tooltip.Arrow className="fill-[var(--border)]" />
    </Tooltip.Content>
  );
}

function clampSpeed(speed: number): number {
  return Math.max(1, Math.min(100, speed));
}

function TransportButton({
  children,
  onClick,
  disabled,
  accent = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
        accent
          ? 'border-[var(--accent)]/45 bg-[var(--accent-soft)] text-[var(--accent)] hover:border-[var(--accent)]/70'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--accent)]/35',
        disabled && 'cursor-not-allowed opacity-40 hover:border-[var(--border)] hover:text-[var(--text-2)]',
      )}
    >
      {children}
    </button>
  );
}

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
    <Tooltip.Provider delayDuration={250}>
      <div className="bg-[var(--surface)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/65 px-3 py-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span>
                  <TransportButton onClick={stepBackward} disabled={!canBack}>
                    <StepBack size={15} />
                  </TransportButton>
                </span>
              </Tooltip.Trigger>
              <Tip>Step backward</Tip>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span>
                  <TransportButton onClick={handlePlayPause} disabled={!hasTrace} accent>
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </TransportButton>
                </span>
              </Tooltip.Trigger>
              <Tip>{isPlaying ? 'Pause playback' : 'Play trace'}</Tip>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span>
                  <TransportButton onClick={stepForward} disabled={!canForward}>
                    <StepForward size={15} />
                  </TransportButton>
                </span>
              </Tooltip.Trigger>
              <Tip>Step forward</Tip>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span>
                  <TransportButton onClick={jumpToEnd} disabled={!canForward}>
                    <SkipForward size={15} />
                  </TransportButton>
                </span>
              </Tooltip.Trigger>
              <Tip>Jump to the end</Tip>
            </Tooltip.Root>
          </div>

          <div className="min-w-[280px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Trace Position</span>
              <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-mono text-[var(--text)]">
                {hasTrace ? currentIndex + 1 : 0}/{total}
              </span>
            </div>
            <StepScrubber
              current={Math.max(0, currentIndex)}
              total={total}
              onChange={seekToStep}
              disabled={!hasTrace}
            />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => setSpeed(clampSpeed(speed - 5))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--text)]"
                >
                  <Minus size={14} />
                </button>
              </Tooltip.Trigger>
              <Tip>Decrease speed by 5x</Tip>
            </Tooltip.Root>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-center font-mono">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Speed</div>
              <div className="mt-0.5 text-sm text-[var(--text)]">{speed}x</div>
            </div>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => setSpeed(1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--text)]"
                >
                  <RotateCcw size={14} />
                </button>
              </Tooltip.Trigger>
              <Tip>Reset speed to 1x</Tip>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => setSpeed(clampSpeed(speed + 5))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--text)]"
                >
                  <Plus size={14} />
                </button>
              </Tooltip.Trigger>
              <Tip>Increase speed by 5x</Tip>
            </Tooltip.Root>
          </div>

          {truncated && (
            <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-xl bg-[#F0883E]/10 text-[#F0883E] border border-[#F0883E]/25 whitespace-nowrap">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F0883E] animate-pulse" />
              Truncated
            </span>
          )}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
