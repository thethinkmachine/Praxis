import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';
import {
  MousePointer2,
  PlusCircle,
  ArrowRightFromLine,
  Ban,
  ArrowLeftRight,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from '@/components/shared/Icons';

export type EditorMode = 'select' | 'addNode' | 'addEdge' | 'delete';

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onClear: () => void;
  isDirected: boolean;
  onToggleDirected: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  rightSlot?: React.ReactNode;
}

const MODES: Array<{ id: EditorMode; label: string; icon: React.ReactNode; tooltip: string }> = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={14} />, tooltip: 'Select and move nodes (V)' },
  { id: 'addNode', label: 'Node', icon: <PlusCircle size={14} />, tooltip: 'Click empty space to add a node (N)' },
  { id: 'addEdge', label: 'Edge', icon: <ArrowRightFromLine size={14} />, tooltip: 'Drag from a source node to create an edge (E)' },
  { id: 'delete', label: 'Delete', icon: <Ban size={14} />, tooltip: 'Delete nodes or edges (D)' },
];

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

function IconButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
        active
          ? 'border-[var(--accent)]/45 bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--accent)]/40',
        disabled && 'cursor-not-allowed opacity-40 hover:border-[var(--border)] hover:text-[var(--text-2)]',
      )}
    >
      {children}
    </button>
  );
}

export default function EditorToolbar({
  mode,
  onModeChange,
  onClear,
  isDirected,
  onToggleDirected,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  rightSlot,
}: EditorToolbarProps) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
          {MODES.map((item) => (
            <Tooltip.Root key={item.id}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => onModeChange(item.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors',
                    mode === item.id
                      ? 'bg-[var(--accent-soft)] text-[var(--text)] border border-[var(--accent)]/35'
                      : 'text-[var(--text-2)] border border-transparent hover:text-[var(--text)] hover:bg-[var(--surface)]',
                  )}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              </Tooltip.Trigger>
              <Tip>{item.tooltip}</Tip>
            </Tooltip.Root>
          ))}
        </div>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={onToggleDirected}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors',
                isDirected
                  ? 'border-[#D2A8FF]/45 bg-[#D2A8FF]/12 text-[#D2A8FF]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]',
              )}
            >
              {isDirected ? <ArrowRight size={14} /> : <ArrowLeftRight size={14} />}
              <span>{isDirected ? 'Directed' : 'Undirected'}</span>
            </button>
          </Tooltip.Trigger>
          <Tip>{isDirected ? 'Switch to undirected graph' : 'Switch to directed graph'}</Tip>
        </Tooltip.Root>

        <div className="flex items-center gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span>
                <IconButton disabled={!canUndo} onClick={onUndo}>
                  <ChevronLeft size={15} />
                </IconButton>
              </span>
            </Tooltip.Trigger>
            <Tip>Undo</Tip>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span>
                <IconButton disabled={!canRedo} onClick={onRedo}>
                  <ChevronRight size={15} />
                </IconButton>
              </span>
            </Tooltip.Trigger>
            <Tip>Redo</Tip>
          </Tooltip.Root>
        </div>

        <div className="min-w-0 flex-1">{rightSlot}</div>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF7B72]/25 bg-[#FF7B72]/8 px-3 py-2 text-xs text-[#FF7B72] transition-colors hover:border-[#FF7B72]/50 hover:bg-[#FF7B72]/12"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          </Tooltip.Trigger>
          <Tip>Clear all nodes and edges</Tip>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
}
