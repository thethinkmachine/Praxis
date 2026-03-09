import * as Popover from '@radix-ui/react-popover';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { 
  Plus, 
  Trash2, 
  Target, 
  Flag, 
  X, 
  Hash,
  Info,
  ChevronRight,
  MousePointer2
} from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

import { createHeuristicEvaluator } from '@/algorithms/search/informed/heuristics';
import type { HeuristicId } from '@/types/problem';

interface AdjacencyTableProps {
  showHeuristics?: boolean;
  showWeights?: boolean;
  heuristicId?: HeuristicId;
  heuristicScale?: number;
}

export default function AdjacencyTable({ 
  showHeuristics = true,
  showWeights = true,
  heuristicId = 'manual-node',
  heuristicScale = 1
}: AdjacencyTableProps) {
  const { 
    nodes, 
    edges, 
    isDirected, 
    startNodeId, 
    goalNodeId, 
    selectedIds,
    updateNode, 
    updateEdge, 
    removeEdge, 
    addEdge, 
    removeNode,
    addNode,
    setSelected,
    setStartNode,
    setGoalNode
  } = useEditorStore();

  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Group edges by source
  // For undirected graphs, we show the edge in BOTH rows because that's how adjacency works logically,
  // but we make sure the ID matches so editing/deleting syncs.
  const groupedEdges = useMemo(() => {
    const map = new Map<string, typeof edges>();
    nodes.forEach(n => map.set(n.id, []));
    edges.forEach(e => {
      if (map.has(e.source)) {
        map.get(e.source)!.push(e);
      }
      if (!isDirected) {
        if (map.has(e.target)) {
          // Virtual mirror edge for undirected
          map.get(e.target)!.push({ ...e, source: e.target, target: e.source });
        }
      }
    });
    return map;
  }, [nodes, edges, isDirected]);

  // Create a memoized heuristic evaluator for the current configuration
  const heuristicEvaluator = useMemo(() => {
    if (!showHeuristics) return null;
    
    // We create a mock Problem object to satisfy the evaluator requirements
    const mockProblem = {
      graph: { nodes, edges },
      startNode: startNodeId ?? '',
      goalNode: goalNodeId ?? '',
      heuristic: { id: heuristicId, params: { scale: heuristicScale } }
    } as any;
    
    try {
      return createHeuristicEvaluator(mockProblem);
    } catch {
      return null;
    }
  }, [showHeuristics, nodes, edges, startNodeId, goalNodeId, heuristicId, heuristicScale]);

  useEffect(() => {
    if (selectedIds.length === 1) {
      const row = rowRefs.current.get(selectedIds[0]);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedIds]);

  const handleAddEdge = (sourceId: string, targetId: string) => {
    addEdge(sourceId, targetId, 1);
    setActiveSourceId(null);
  };

  const handleAddNode = () => {
    const id = addNode({ 
      x: 300 + (Math.random() - 0.5) * 80, 
      y: 250 + (Math.random() - 0.5) * 80 
    });
    setSelected([id]);
  };

  const handleCreateAndConnect = (sourceId: string) => {
    const newNodeId = addNode({ 
      x: 300 + (Math.random() - 0.5) * 80, 
      y: 250 + (Math.random() - 0.5) * 80 
    });
    addEdge(sourceId, newNodeId, 1);
    setActiveSourceId(null);
  };

  const toggleStart = (id: string, current: boolean) => {
    setStartNode(current ? null : id);
  };

  const toggleGoal = (id: string, current: boolean) => {
    setGoalNode(current ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Topology</p>
          <h3 className="text-[12px] font-bold text-[var(--text)]">Adjacency List</h3>
        </div>
        <button 
          onClick={handleAddNode}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-all active:scale-95"
        >
          <Plus size={12} />
          Add Node
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-md">
        <div 
          ref={containerRef}
          className="overflow-x-auto overflow-y-auto max-h-[450px] scrollbar-thin transition-all"
        >
          <table className="w-full text-left border-collapse min-w-[360px]">
            <thead>
              <tr className="sticky top-0 z-30 bg-[var(--surface-2)] text-[10px] uppercase tracking-wider text-[var(--text-3)] border-b border-[var(--border)]">
                <th className="px-3 py-2 font-semibold">Node</th>
                <th className="px-1 py-2 font-semibold w-12 text-center text-[var(--text-4)]">S/G</th>
                {showHeuristics && <th className="px-2 py-2 font-semibold w-14 text-center">h(n)</th>}
                <th className="px-3 py-2 font-semibold text-[var(--text-3)]">Links</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {nodes.map((node) => {
                const isSelected = selectedIds.includes(node.id);
                const nodeEdges = groupedEdges.get(node.id) || [];
                const isStart = startNodeId === node.id;
                const isGoal = goalNodeId === node.id;

                return (
                  <tr 
                    key={node.id} 
                    ref={el => el ? rowRefs.current.set(node.id, el) : rowRefs.current.delete(node.id)}
                    className={cn(
                      "group transition-all duration-150",
                      isSelected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]/50"
                    )}
                    onClick={() => setSelected([node.id])}
                  >
                    {/* Node Info & Name */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={node.label ?? node.id}
                          onChange={(e) => updateNode(node.id, { label: e.target.value })}
                          className="w-full bg-transparent border-none focus:ring-0 rounded-sm px-0 text-[11px] font-mono font-bold text-[var(--text)] transition-colors focus:bg-[var(--accent)]/5 focus:text-[var(--accent)]"
                          onClick={(e) => e.stopPropagation()}
                          placeholder={node.id}
                        />
                      </div>
                    </td>

                    {/* S/G Toggles */}
                    <td className="px-1 py-2">
                       <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStart(node.id, isStart); }}
                            className={cn(
                              "w-5 h-5 flex items-center justify-center rounded transition-all",
                              isStart 
                                ? "bg-[var(--purple)] text-white shadow-[0_0_8px_var(--purple)]/30" 
                                : "text-[var(--text-4)] hover:bg-[var(--surface-3)] hover:text-[var(--text-2)]"
                            )}
                            title="Toggle Start Node"
                          >
                            <Target size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGoal(node.id, isGoal); }}
                            className={cn(
                              "w-5 h-5 flex items-center justify-center rounded transition-all",
                              isGoal 
                                ? "bg-[var(--success)] text-white shadow-[0_0_8px_var(--success)]/30" 
                                : "text-[var(--text-4)] hover:bg-[var(--surface-3)] hover:text-[var(--text-2)]"
                            )}
                            title="Toggle Goal Node"
                          >
                            <Flag size={11} />
                          </button>
                       </div>
                    </td>

                    {/* Heuristic Input */}
                    {showHeuristics && (
                      <td className="px-1 py-2">
                        {heuristicId === 'manual-node' ? (
                          <input
                            type="number"
                            step={1}
                            value={node.heuristic ?? ''}
                            onChange={(e) => {
                               const val = e.target.value === '' ? undefined : Number(e.target.value);
                               updateNode(node.id, { heuristic: val });
                            }}
                            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-center font-mono text-[var(--accent)] focus:border-[var(--accent)]/50 outline-none transition-all shadow-inner"
                            placeholder="0"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div 
                            className="w-full bg-[var(--surface-3)]/40 border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-center font-mono text-[var(--text-3)] select-none opacity-80"
                            title={`Calculated via ${heuristicId}`}
                          >
                            {heuristicEvaluator ? heuristicEvaluator(node.id).toFixed(1) : '0.0'}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Neighbors List */}
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1.5 min-h-[26px] items-center">
                        {nodeEdges.map(edge => {
                          const targetNode = nodes.find(n => n.id === edge.target);
                          const isEdgeSelected = selectedIds.includes(edge.id);
                          return (
                            <div 
                              key={`${node.id}-${edge.target}-${edge.id}`}
                              className={cn(
                                "flex items-center gap-1 bg-[var(--surface-2)] border rounded px-1.5 py-0.5 group/edge transition-all",
                                isEdgeSelected ? "border-[var(--accent)]/70 bg-[var(--accent-soft)]" : "border-[var(--border)] hover:border-[var(--text-4)]"
                              )}
                              onClick={(e) => { e.stopPropagation(); setSelected([edge.id]); }}
                            >
                              <span className="text-[9px] font-mono font-bold text-[var(--text-3)] max-w-[50px] truncate group-hover/edge:text-[var(--text-2)]">
                                {targetNode?.label ?? edge.target}
                              </span>
                              
                              {showWeights && (
                                <>
                                  <ChevronRight size={8} className="text-[var(--text-4)] shrink-0" />
                                  <input
                                    type="number"
                                    step={1}
                                    min={0}
                                    value={edge.weight}
                                    onChange={(e) => updateEdge(edge.id, { weight: Math.max(0, Number(e.target.value)) })}
                                    className="w-6 bg-transparent border-none px-0 text-[10px] font-mono font-bold text-center text-[var(--accent)] focus:ring-0"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </>
                              )}

                              <button 
                                onClick={(e) => { e.stopPropagation(); removeEdge(edge.id); }}
                                className="text-[var(--text-4)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover/edge:opacity-100 ml-0.5"
                              >
                                <X size={9} />
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Add Edge Interaction */}
                        <Popover.Root 
                          open={activeSourceId === node.id} 
                          onOpenChange={(open) => setActiveSourceId(open ? node.id : null)}
                        >
                          <Popover.Trigger asChild>
                            <button 
                              className={cn(
                                "flex items-center justify-center w-5 h-5 rounded border border-dashed transition-all",
                                activeSourceId === node.id 
                                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]" 
                                  : "border-[var(--border)] text-[var(--text-4)] hover:border-[var(--text-3)] hover:text-[var(--text-2)]"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Plus size={10} /> 
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content 
                              className="z-[100] bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg shadow-2xl min-w-[160px] max-h-56 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-150"
                              sideOffset={5}
                              align="start"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="px-2.5 py-1.5 border-b border-[var(--border)] mb-1 flex items-center justify-between sticky top-0 bg-[var(--surface-2)] z-10 shadow-sm">
                                <p className="text-[8px] uppercase tracking-widest text-[var(--text-4)] font-bold">Connect To</p>
                                <X size={10} className="cursor-pointer text-[var(--text-4)] hover:text-[var(--text)]" onClick={() => setActiveSourceId(null)} />
                              </div>
                              
                              <div className="max-h-36 overflow-y-auto">
                                {nodes
                                  .filter(n => n.id !== node.id && !nodeEdges.some(e => e.target === n.id))
                                  .map(candidate => (
                                    <button
                                      key={candidate.id}
                                      className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[var(--accent-soft)] text-[var(--text-2)] hover:text-[var(--accent)] transition-colors font-medium"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddEdge(node.id, candidate.id);
                                      }}
                                    >
                                      {candidate.label ?? candidate.id}
                                    </button>
                                  ))
                                }
                                {nodes.filter(n => n.id !== node.id && !nodeEdges.some(e => e.target === n.id)).length === 0 && (
                                  <div className="px-3 py-3 text-[9px] text-[var(--text-4)] italic text-center">
                                    All existing nodes connected
                                  </div>
                                )}
                              </div>

                              <div className="border-t border-[var(--border)] mt-1 pt-1 px-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateAndConnect(node.id);
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-2 py-2 text-[10px] rounded hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-all font-bold group/newnode"
                                >
                                  <Plus size={10} className="group-hover/newnode:scale-125 transition-transform" /> 
                                  <span>Spawn & Link New Node</span>
                                </button>
                              </div>
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right">
                       <button 
                         onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                         className="p-1 opacity-0 group-hover:opacity-100 text-[var(--text-4)] hover:text-[var(--danger)] transition-all hover:bg-[var(--danger)]/10 rounded"
                         title="Delete Node"
                       >
                         <Trash2 size={12} />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--accent-soft)]/30 border border-[var(--accent)]/10">
         <div className="bg-[var(--surface)] p-1 rounded-md shadow-sm">
           <MousePointer2 size={12} className="text-[var(--accent)]" />
         </div>
         <p className="text-[9px] text-[var(--text-3)] leading-relaxed italic">
           Tip: Use <kbd className="font-sans px-1 bg-[var(--surface-3)] border border-[var(--border)] rounded text-[8px] font-bold">S</kbd> to toggle Start or <kbd className="font-sans px-1 bg-[var(--surface-3)] border border-[var(--border)] rounded text-[8px] font-bold">G</kbd> for Goal.
         </p>
      </div>
    </div>
  );
}
