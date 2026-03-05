import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

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

const MODES: { id: EditorMode; label: string; icon: string; tooltip: string }[] = [
  { id: 'select',  label: 'Select',  icon: '↖',  tooltip: 'Select / move nodes (V)' },
  { id: 'addNode', label: 'Node',    icon: '⊕',  tooltip: 'Click empty area to add node (N)' },
  { id: 'addEdge', label: 'Edge',    icon: '⤳',  tooltip: 'Drag from node to node to add edge (E)' },
  { id: 'delete',  label: 'Delete',  icon: '✕',  tooltip: 'Click element to delete (D)' },
];

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Content
      sideOffset={5}
      className="z-50 px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[10px] text-[var(--text)] shadow-md select-none"
    >
      {children}
      <Tooltip.Arrow className="fill-[var(--border)]" />
    </Tooltip.Content>
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
    <Tooltip.Provider delayDuration={400}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border-b border-[var(--border)]">
        {/* Mode buttons */}
        <div className="flex items-center gap-1">
          {MODES.map((m) => (
            <Tooltip.Root key={m.id}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => onModeChange(m.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
                    mode === m.id
                      ? 'bg-[#58A6FF]/20 text-[#58A6FF] border border-[#58A6FF]/40'
                      : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-transparent'
                  )}
                >
                  <span className="text-sm leading-none">{m.icon}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              </Tooltip.Trigger>
              <Tip>{m.tooltip}</Tip>
            </Tooltip.Root>
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--border)]" />

        {/* Directed toggle */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={onToggleDirected}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border',
                isDirected
                  ? 'bg-[#D2A8FF]/15 text-[#D2A8FF] border-[#D2A8FF]/40'
                  : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border-transparent'
              )}
            >
              {isDirected ? '→' : '↔'}
              <span className="hidden sm:inline ml-1">{isDirected ? 'Directed' : 'Undirected'}</span>
            </button>
          </Tooltip.Trigger>
          <Tip>{isDirected ? 'Switch to undirected graph' : 'Switch to directed graph'}</Tip>
        </Tooltip.Root>

        <div className="w-px h-5 bg-[var(--border)]" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-colors border border-transparent',
                  canUndo
                    ? 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                    : 'text-[var(--text-3)] opacity-40 cursor-not-allowed'
                )}
              >
                ↩
              </button>
            </Tooltip.Trigger>
            <Tip>Undo <kbd className="ml-1 opacity-50">Ctrl+Z</kbd></Tip>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-colors border border-transparent',
                  canRedo
                    ? 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                    : 'text-[var(--text-3)] opacity-40 cursor-not-allowed'
                )}
              >
                ↪
              </button>
            </Tooltip.Trigger>
            <Tip>Redo <kbd className="ml-1 opacity-50">Ctrl+Y</kbd></Tip>
          </Tooltip.Root>
        </div>

        <div className="flex-1" />

        {/* Clear button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-[#FF7B72]/70 hover:text-[#FF7B72] hover:bg-[#FF7B72]/10 border border-transparent hover:border-[#FF7B72]/30 transition-colors"
            >
              <span>⊘</span>
              <span className="hidden sm:inline">Clear</span>
            </button>
          </Tooltip.Trigger>
          <Tip>Clear all nodes and edges</Tip>
        </Tooltip.Root>

        {rightSlot && (
          <>
            <div className="w-px h-5 bg-[var(--border)]" />
            {rightSlot}
          </>
        )}
      </div>
    </Tooltip.Provider>
  );
}
