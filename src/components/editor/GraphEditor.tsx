import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import EditorToolbar, { type EditorMode } from './EditorToolbar';
import { useEditorStore } from '@/store/useEditorStore';
import { useCytoscape } from '@/hooks/useCytoscape';
import type { StylesheetStyle } from 'cytoscape';

interface ContextMenu {
  x: number;
  y: number;
  type: 'node' | 'edge';
  targetId: string;
}

interface GraphEditorProps {
  startNodeId?: string;
  goalNodeId?: string;
  onGraphChange?: (nodes: unknown[], edges: unknown[]) => void;
}

const STYLESHEET: StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': '#21262D',
      'border-color': '#58A6FF',
      'border-width': 2,
      color: '#E6EDF3',
      label: 'data(label)',
      'font-size': 11,
      'text-valign': 'center',
      'text-halign': 'center',
      width: 40,
      height: 40,
    },
  },
  {
    selector: 'node[?isStart]',
    style: {
      'background-color': '#D2A8FF33',
      'border-color': '#D2A8FF',
    },
  },
  {
    selector: 'node[?isGoal]',
    style: {
      'background-color': '#3FB95033',
      'border-color': '#3FB950',
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#F0883E',
      'border-width': 3,
    },
  },
  {
    selector: 'edge',
    style: {
      'line-color': '#484F58',
      'target-arrow-color': '#484F58',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      label: 'data(weight)',
      'font-size': 10,
      color: '#7D8590',
      width: 2,
      'text-background-color': '#0F1117',
      'text-background-opacity': 0.8,
      'text-background-padding': '2px',
    },
  },
  {
    selector: 'edge:selected',
    style: {
      'line-color': '#F0883E',
      'target-arrow-color': '#F0883E',
    },
  },
  // edgehandles preview ghost edge
  {
    selector: '.eh-handle',
    style: {
      'background-color': '#58A6FF',
      width: 12,
      height: 12,
    },
  },
  {
    selector: '.eh-ghost-edge',
    style: {
      'line-color': '#58A6FF',
      'target-arrow-color': '#58A6FF',
      'line-style': 'dashed',
    },
  },
];

export default function GraphEditor({
  startNodeId,
  goalNodeId,
  onGraphChange,
}: GraphEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const {
    nodes,
    edges,
    addNode,
    addEdge,
    removeNode,
    removeEdge,
    setStartNode,
    setGoalNode,
    clear,
    isDirected,
    setDirected,
    startNodeId: storedStartId,
    goalNodeId: storedGoalId,
  } = useEditorStore();

  const effectiveStartId = startNodeId ?? storedStartId;
  const effectiveGoalId = goalNodeId ?? storedGoalId;

  const elements = [
    ...nodes.map((n) => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        label: n.label ?? n.id,
        isStart: n.id === effectiveStartId || undefined,
        isGoal: n.id === effectiveGoalId || undefined,
      },
      position: n.x !== undefined ? { x: n.x, y: n.y ?? 0 } : undefined,
    })),
    ...edges.map((e) => ({
      group: 'edges' as const,
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        weight: e.weight ?? 1,
        directed: isDirected || undefined,
      },
    })),
  ];

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setContextMenu(null);
      if (mode === 'delete') {
        const { nodes: currentNodes, edges: currentEdges } = useEditorStore.getState();
        removeNode(nodeId);
        onGraphChange?.(currentNodes.filter((n) => n.id !== nodeId), currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId));
      }
    },
    [mode, removeNode, onGraphChange]
  );

  const handleNodeRightClick = useCallback(
    (nodeId: string, pos: { x: number; y: number }) => {
      setContextMenu({ x: pos.x, y: pos.y, type: 'node', targetId: nodeId });
    },
    []
  );

  const handleEdgeRightClick = useCallback(
    (edgeId: string, pos: { x: number; y: number }) => {
      setContextMenu({ x: pos.x, y: pos.y, type: 'edge', targetId: edgeId });
    },
    []
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      setContextMenu(null);
      if (mode === 'delete') {
        removeEdge(edgeId);
        const { nodes: currentNodes, edges: currentEdges } = useEditorStore.getState();
        onGraphChange?.(currentNodes, currentEdges);
      }
    },
    [mode, removeEdge, onGraphChange]
  );

  const handleBgClick = useCallback(
    (pos: { x: number; y: number }) => {
      setContextMenu(null);
      if (mode === 'addNode') {
        addNode({ x: pos.x, y: pos.y });
        const { nodes: currentNodes, edges: currentEdges } = useEditorStore.getState();
        onGraphChange?.(currentNodes, currentEdges);
      }
    },
    [mode, addNode, onGraphChange]
  );

  const handleEdgeAdded = useCallback(
    (sourceId: string, targetId: string) => {
      addEdge(sourceId, targetId, 1);
      const { nodes: currentNodes, edges: currentEdges } = useEditorStore.getState();
      onGraphChange?.(currentNodes, currentEdges);
    },
    [addEdge, onGraphChange]
  );

  const { updateElements, fit, enableEdgeDrawMode, disableEdgeDrawMode } = useCytoscape(containerRef, {
    elements,
    stylesheet: STYLESHEET,
    layout: { name: 'preset' },
    onNodeClick: handleNodeClick,
    onNodeRightClick: handleNodeRightClick,
    onEdgeClick: handleEdgeClick,
    onEdgeRightClick: handleEdgeRightClick,
    onBackgroundClick: handleBgClick,
    onEdgeAdded: handleEdgeAdded,
    autoFit: false,
  });

  // Reactively sync canvas whenever elements change
  useEffect(() => {
    updateElements(elements, { name: 'preset' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, effectiveStartId, effectiveGoalId, isDirected, updateElements]);

  // Toggle edge draw mode when mode changes
  useEffect(() => {
    if (mode === 'addEdge') {
      enableEdgeDrawMode();
    } else {
      disableEdgeDrawMode();
    }
  }, [mode, enableEdgeDrawMode, disableEdgeDrawMode]);

  function handleClear() {
    clear();
    onGraphChange?.([], []);
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
      <EditorToolbar
        mode={mode}
        onModeChange={setMode}
        onClear={handleClear}
        isDirected={isDirected}
        onToggleDirected={() => setDirected(!isDirected)}
      />

      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />

        {/* Fit button */}
        <button
          onClick={() => fit()}
          className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] hover:text-[var(--text)] transition-colors"
        >
          ⊡ Fit
        </button>

        {/* Mode hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-[var(--text-3)] pointer-events-none">
          {mode === 'addNode' && 'Click empty area to add node'}
          {mode === 'addEdge' && 'Drag from source node to target node'}
          {mode === 'delete' && 'Click node or edge to delete'}
          {mode === 'select' && 'Drag nodes to reposition • Right-click for options'}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            className={cn('absolute z-50 bg-[var(--surface-2)] border border-[var(--border)] rounded shadow-lg py-1 min-w-[140px]')}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'node' && (
              <>
                <button
                  className="w-full text-left text-xs px-3 py-1.5 text-[#D2A8FF] hover:bg-[#D2A8FF]/10"
                  onClick={() => { setStartNode(contextMenu.targetId); setContextMenu(null); }}
                >
                  Set as Start
                </button>
                <button
                  className="w-full text-left text-xs px-3 py-1.5 text-[#3FB950] hover:bg-[#3FB950]/10"
                  onClick={() => { setGoalNode(contextMenu.targetId); setContextMenu(null); }}
                >
                  Set as Goal
                </button>
                <div className="border-t border-[var(--border)] my-1" />
                <button
                  className="w-full text-left text-xs px-3 py-1.5 text-[#FF7B72] hover:bg-[#FF7B72]/10"
                  onClick={() => { removeNode(contextMenu.targetId); setContextMenu(null); }}
                >
                  Delete Node
                </button>
              </>
            )}
            {contextMenu.type === 'edge' && (
              <button
                className="w-full text-left text-xs px-3 py-1.5 text-[#FF7B72] hover:bg-[#FF7B72]/10"
                onClick={() => { removeEdge(contextMenu.targetId); setContextMenu(null); }}
              >
                Delete Edge
              </button>
            )}
            <button
              className="w-full text-left text-xs px-3 py-1.5 text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              onClick={() => setContextMenu(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
