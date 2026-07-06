import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// A floating right-click menu for a graph node or edge. Owns its own
// dismissal behavior (outside click, Escape, viewport clamping) so callers
// only need to supply the action handlers and a close callback.
// ---------------------------------------------------------------------------

interface NodeContextMenuProps {
  type: 'node';
  x: number;
  y: number;
  onRename: () => void;
  onEditHeuristic: () => void;
  onSetStart: () => void;
  onSetGoal: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface EdgeContextMenuProps {
  type: 'edge';
  x: number;
  y: number;
  onEditWeight: () => void;
  onDelete: () => void;
  onClose: () => void;
}

type GraphContextMenuProps = NodeContextMenuProps | EdgeContextMenuProps;

export default function GraphContextMenu(props: GraphContextMenuProps) {
  const { x, y, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp to the viewport once we know the menu's actual rendered size.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(x, Math.max(margin, window.innerWidth - rect.width - margin));
    const top = Math.min(y, Math.max(margin, window.innerHeight - rect.height - margin));
    setPos({ left, top });
  }, [x, y]);

  // Dismiss on outside click/tap or Escape. The pointerdown listener runs in
  // the capture phase so it fires before any target-level handler (e.g. d3
  // drag-start) can call stopPropagation() and swallow it.
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
      className="ui-menu fixed z-[110] rounded-lg py-1 min-w-[160px]"
      style={{ left: pos.left, top: pos.top }}
    >
      {props.type === 'node' ? (
        <>
          <button role="menuitem" className="ui-menu-item text-[var(--text)]" onClick={select(props.onRename)}>
            Rename Node
          </button>
          <button role="menuitem" className="ui-menu-item ui-menu-item-accent" onClick={select(props.onEditHeuristic)}>
            Edit h(n)
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button role="menuitem" className="ui-menu-item ui-menu-item-purple" onClick={select(props.onSetStart)}>
            Set as Start
          </button>
          <button role="menuitem" className="ui-menu-item ui-menu-item-success" onClick={select(props.onSetGoal)}>
            Set as Goal
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button role="menuitem" className="ui-menu-item ui-menu-item-danger" onClick={select(props.onDelete)}>
            Delete Node
          </button>
        </>
      ) : (
        <>
          <button role="menuitem" className="ui-menu-item text-[var(--text)]" onClick={select(props.onEditWeight)}>
            Edit Weight
          </button>
          <div className="border-t border-[var(--border)] my-1" />
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
