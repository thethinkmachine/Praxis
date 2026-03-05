import { useMemo, useCallback } from 'react';
import { useEditorStore } from '@/store/editor.store';
import { Graph } from '@/lib/graph';
import type { GraphData } from '@/types/problem';

export function useGraphEditor() {
  const store = useEditorStore();

  // Select individual stable pieces for dependency tracking
  const mode = useEditorStore(s => s.mode);
  const addNode = useEditorStore(s => s.addNode);
  const removeNode = useEditorStore(s => s.removeNode);
  const setSelected = useEditorStore(s => s.setSelected);
  const removeEdge = useEditorStore(s => s.removeEdge);

  const graphData: GraphData = useMemo(() => ({
    nodes: store.nodes,
    edges: store.edges,
    directed: store.isDirected,
  }), [store.nodes, store.edges, store.isDirected]);

  const graph = useMemo(() => Graph.fromData(graphData), [graphData]);

  const isValid = useMemo(() => {
    return store.startNodeId !== null && store.goalNodeId !== null && store.nodes.length >= 2;
  }, [store.startNodeId, store.goalNodeId, store.nodes.length]);

  const handleBackgroundClick = useCallback((pos: { x: number; y: number }) => {
    if (mode === 'addNode') {
      addNode({ x: pos.x, y: pos.y, label: undefined });
    }
  }, [mode, addNode]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (mode === 'delete') {
      removeNode(nodeId);
    } else if (mode === 'select') {
      setSelected([nodeId]);
    }
  }, [mode, removeNode, setSelected]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    if (mode === 'delete') {
      removeEdge(edgeId);
    }
  }, [mode, removeEdge]);

  return {
    ...store,
    graphData,
    graph,
    isValid,
    handleBackgroundClick,
    handleNodeClick,
    handleEdgeClick,
  };
}
