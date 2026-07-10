import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { GameTreeNodeKind } from '@/types/problem';

// ---------------------------------------------------------------------------
// Right-click menu for a game-tree node or edge. Mirrors GraphContextMenu's
// self-dismissal (outside click / Escape / viewport clamp) so callers only
// supply the action handlers.
// ---------------------------------------------------------------------------

interface NodeContextMenuProps {
  type: 'node';
  x: number;
  y: number;
  currentKind: GameTreeNodeKind;
  isRoot: boolean;
  onSetKind: (kind: GameTreeNodeKind) => void;
  onSetRoot: () => void;
  onEditValue: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface EdgeContextMenuProps {
  type: 'edge';
  x: number;
  y: number;
  canEditProbability: boolean;
  onEditProbability: () => void;
  onDelete: () => void;
  onClose: () => void;
}

type GameTreeContextMenuProps = NodeContextMenuProps | EdgeContextMenuProps;

const KIND_OPTIONS: Array<{ id: GameTreeNodeKind; label: string }> = [
  { id: 'max', label: 'Max' },
  { id: 'min', label: 'Min' },
  { id: 'chance', label: 'Chance' },
  { id: 'terminal', label: 'Leaf' },
];

export default function GameTreeContextMenu(props: GameTreeContextMenuProps) {
  const { x, y, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(x, Math.max(margin, window.innerWidth - rect.width - margin));
    const top = Math.min(y, Math.max(margin, window.innerHeight - rect.height - margin));
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const select = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      className="ui-menu fixed z-[110] rounded-lg py-1 min-w-[176px]"
      style={{ left: pos.left, top: pos.top }}
    >
      {props.type === 'node' ? (
        <>
          <div className="px-3 pb-1 pt-0.5 text-[9px] uppercase tracking-[0.16em] text-[var(--text-3)]">Node Type</div>
          <div className="grid grid-cols-4 gap-1 px-2 pb-1.5">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.id}
                role="menuitem"
                onClick={select(() => props.onSetKind(option.id))}
                className={cn(
                  'rounded-md border px-1 py-1 text-[10px] font-medium transition-colors',
                  props.currentKind === option.id
                    ? 'border-[var(--accent)]/55 bg-[var(--accent-soft)] text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--border)] my-1" />
          {props.currentKind === 'terminal' && (
            <button role="menuitem" className="ui-menu-item ui-menu-item-accent" onClick={select(props.onEditValue)}>
              Edit Value
            </button>
          )}
          <button role="menuitem" className="ui-menu-item ui-menu-item-purple" onClick={select(props.onSetRoot)} disabled={props.isRoot}>
            {props.isRoot ? 'Is Root' : 'Set as Root'}
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button role="menuitem" className="ui-menu-item ui-menu-item-danger" onClick={select(props.onDelete)}>
            Delete Node
          </button>
        </>
      ) : (
        <>
          {props.canEditProbability && (
            <button role="menuitem" className="ui-menu-item ui-menu-item-accent" onClick={select(props.onEditProbability)}>
              Edit Probability
            </button>
          )}
          <button role="menuitem" className="ui-menu-item ui-menu-item-danger" onClick={select(props.onDelete)}>
            Delete Edge
          </button>
        </>
      )}
      <button role="menuitem" className="ui-menu-item" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
