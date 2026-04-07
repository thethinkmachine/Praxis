import { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { registry } from '@/algorithms/core/registry';
import { useEditorStore } from '@/store/useEditorStore';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import SVGGraphCanvas from '@/components/visualization/SVGGraphCanvas';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import DemoProblemPicker from '@/components/editor/DemoProblemPicker';
import { Dice5, Info, ChevronDown } from '@/components/shared/Icons';
import { TitleBarActionButton } from '@/components/shared/TitleBarAction';
import Select from '@/components/shared/Select';
import EmptyState from '@/components/shared/EmptyState';
import InfoCard from '@/components/shared/InfoCard';
import HeuristicConfigSection from '@/components/shared/HeuristicConfigSection';
import { generateRandomGraph } from '@/lib/random-generators';
import { INFORMED_HEURISTICS, getHeuristicDefinition } from '@/algorithms/search/informed/types';
import { createGraphSearchAdapterFromProblem } from '@/visualizations/adapters/graph-search.adapter';
import { getGraphSearchStyles } from '@/visualizations/cytoscapeStyles/graph-search.styles';
import { buildSearchTreeElements } from '@/visualizations/adapters/search-tree.adapter';
import { evaluationFormula } from '@/lib/evaluationFormula';

import type { AlgorithmStep } from '@/types/step';
import { Graph, type GraphProblem, type HeuristicId } from '@/types/problem';

import AdjacencyTable from '@/components/editor/AdjacencyTable';

// Algorithm categorization for UI behavior
const INFORMED_ALGOS = new Set(['greedy-bfs', 'astar', 'rbfs', 'sma-star', 'smgs', 'bidirectional-astar', 'weighted-astar', 'ida-star']);
const UNWEIGHTED_ALGOS = new Set(['bfs', 'dfs', 'dls', 'iddfs', 'bidirectional-bfs']);

export default function SearchPage() {
  const { algo = 'bfs' } = useParams<{ category: string; algo: string }>();
  const [depthLimit, setDepthLimit] = useState(12);
  const [weightedAStarWeight, setWeightedAStarWeight] = useState(1.5);
  const [memoryLimit, setMemoryLimit] = useState(64);
  const [heuristicId, setHeuristicId] = useState<HeuristicId>('manual-node');
  const [heuristicScale, setHeuristicScale] = useState(1);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);

  // ── Runner (for meta.category in SVGGraphCanvas) ─────────────────────
  const runner = useMemo(() => registry.get(algo)?.runner ?? null, [algo]);
  const isInformedAlgorithm = INFORMED_ALGOS.has(algo);
  const isWeightedAlgorithm = !UNWEIGHTED_ALGOS.has(algo);
  const heuristicDefinition = useMemo(() => getHeuristicDefinition(heuristicId), [heuristicId]);

  // ── Execution store read (step needed for visualization memos) ───────
  const step = useExecutionStore(s => s.currentStep) as AlgorithmStep | null;

  // ── Editor store subscriptions ───────────────────────────────────────
  const editorNodes = useEditorStore(s => s.nodes);
  const editorEdges = useEditorStore(s => s.edges);
  const editorStartId = useEditorStore(s => s.startNodeId);
  const editorGoalId = useEditorStore(s => s.goalNodeId);
  const editorIsDirected = useEditorStore(s => s.isDirected);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const updateNode = useEditorStore(s => s.updateNode);
  const setSelected = useEditorStore(s => s.setSelected);

  // Whether the chosen heuristic requires spatial coordinates (x,y) to evaluate.
  const heuristicNeedsGeometry = isInformedAlgorithm && heuristicDefinition.requiresGeometry === true;

  // Topology fingerprint — stable string that changes only when nodes are
  // added/removed/renamed, NOT when positions change.
  // Exception: when using a geometry-based heuristic, position changes ARE
  // topologically significant because they alter h(n).
  const nodeTopoKey = useEditorStore(
    s => s.nodes
      .map(n => {
        const base = `${n.id}:${n.label ?? ''}:${n.heuristic ?? ''}`;
        return heuristicNeedsGeometry ? `${base}:${n.x ?? ''}:${n.y ?? ''}` : base;
      })
      .sort()
      .join(','),
  );

  // ── Pre-load Romania map on first mount ──────────────────────────────
  useEffect(() => {
    fetch('/Praxis/problems/graphs/romania-map.json')
      .then(res => res.json())
      .then(data => {
        const p = data.problem;
        useEditorStore.getState().loadGraph(
          p.graph.nodes,
          p.graph.edges,
          p.startNode,
          p.goalNode,
          p.graph.directed ?? false
        );
      })
      .catch(err => console.error("Failed to preload Romania Map:", err));
  }, []);

  // ── Demo selector ────────────────────────────────────────────────────
  const handleDemoSelect = useCallback((problem: unknown) => {
    const p = problem as GraphProblem;
    // We already passed the exact json problem shape from `fetch` in Picker
    if (p?.graph?.nodes && p?.graph?.edges) {
      useEditorStore.getState().loadGraph(
        p.graph.nodes,
        p.graph.edges,
        p.startNode ?? '',
        p.goalNode ?? '',
        p.graph.directed ?? false,
      );
    }
  }, []);

  // ── Problems ─────────────────────────────────────────────────────────
  // algoProblem: topology-only by default (no positions) — so dragging
  // nodes doesn't reload the engine. But geometry-based heuristics NEED
  // positions to compute h(n), so include them when required.
  const algoProblem = useMemo<GraphProblem>(() => {
    const currentNodes = useEditorStore.getState().nodes;
    const algoNodes = heuristicNeedsGeometry
      ? currentNodes                             // keep x,y for distance heuristics
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      : currentNodes.map(({ x: _x, y: _y, ...n }) => n); // strip positions
    const baseProblem = {
      graph: new Graph({ directed: editorIsDirected, nodes: algoNodes, edges: editorEdges }),
      startNode: editorStartId ?? '',
      goalNode: editorGoalId ?? '',
      useHeuristic: isInformedAlgorithm,
      heuristic: isInformedAlgorithm
        ? {
            id: heuristicId,
            params: heuristicScale !== 1 ? { scale: heuristicScale } : undefined,
          }
        : undefined,
    };
    if (algo === 'dls') {
      return { ...baseProblem, depthLimit };
    }
    if (algo === 'weighted-astar') {
      return { ...baseProblem, weight: weightedAStarWeight };
    }
    if (algo === 'sma-star' || algo === 'smgs') {
      return { ...baseProblem, memoryLimit };
    }
    return baseProblem;
  }, [algo, nodeTopoKey, editorEdges, editorStartId, editorGoalId, editorIsDirected, isInformedAlgorithm, heuristicId, heuristicScale, heuristicNeedsGeometry, depthLimit, weightedAStarWeight, memoryLimit]);

  // displayProblem: includes positions — used only for Cytoscape element generation.
  const displayProblem = useMemo<GraphProblem>(() => ({
    graph: new Graph({ directed: editorIsDirected, nodes: editorNodes, edges: editorEdges }),
    startNode: editorStartId ?? '',
    goalNode: editorGoalId ?? '',
    useHeuristic: isInformedAlgorithm,
    heuristic: isInformedAlgorithm
      ? {
          id: heuristicId,
          params: heuristicScale !== 1 ? { scale: heuristicScale } : undefined,
        }
      : undefined,
  }), [editorNodes, editorEdges, editorStartId, editorGoalId, editorIsDirected, isInformedAlgorithm, heuristicId, heuristicScale]);

  // ── Stylesheet ───────────────────────────────────────────────────────
  const stylesheet = useMemo(
    () => getGraphSearchStyles(isWeightedAlgorithm),
    [isWeightedAlgorithm],
  );

  // ── Cytoscape elements (colored by algorithm state) ──────────────────
  const algorithmElements = useMemo(() => {
    if (!step) return [];
    try {
      return createGraphSearchAdapterFromProblem(
        displayProblem.graph,
        displayProblem.startNode,
        displayProblem.goalNode,
      ).toCytoscapeElements(step as unknown as AlgorithmStep<never, never>);
    } catch {
      return [];
    }
  }, [step, displayProblem]);

  // ── Node label map (for tree node display names) ─────────────────────
  const labelMap = useMemo(
    () => new Map(editorNodes.map(n => [n.id, n.label ?? n.id])),
    [editorNodes],
  );

  // ── Search tree Cytoscape elements ───────────────────────────────────
  const treeElements = useMemo(() => {
    if (!step) return [];
    try {
      const st = step.state as Record<string, unknown>;
      const pathMap = st.pathMap instanceof Map
        ? st.pathMap as Map<string, string | null>
        : new Map<string, string | null>();
      const foundPath = Array.isArray(st.foundPath) ? st.foundPath as string[] : null;

      const gCosts = (st.gCosts instanceof Map ? st.gCosts : st.costs instanceof Map ? st.costs : undefined) as Map<string, number> | undefined;
      const hCosts = (st.hCosts instanceof Map ? st.hCosts : undefined) as Map<string, number> | undefined;
      const fCosts = (st.fCosts instanceof Map ? st.fCosts : undefined) as Map<string, number> | undefined;

      const highlight = step.highlight as {
        frontierNodes?: Set<string>;
        exploredNodes?: Set<string>;
        currentNode?: string | null;
        pathEdges?: string[] | null;
      };

      return buildSearchTreeElements(pathMap, highlight, foundPath, {
        startNode: displayProblem.startNode,
        goalNode: displayProblem.goalNode,
        labelMap,
        gCosts,
        hCosts,
        fCosts,
        graph: displayProblem.graph,
      });
    } catch {
      return [];
    }
  }, [step, displayProblem.startNode, displayProblem.goalNode, labelMap]);

  // ── Tabs ─────────────────────────────────────────────────────────────
  const tabs: TabDefinition[] = useMemo(() => [
    {
      id: 'graph',
      label: 'Problem View',
      content: (
        <SVGGraphCanvas
          algorithmElements={algorithmElements}
          stylesheet={stylesheet}
          description={step?.description}
          algorithmCategory={runner?.meta.category ?? 'uninformed-search'}
          onDemoSelect={handleDemoSelect}
          snapToGrid={heuristicId === 'manhattan-distance' || heuristicId === 'chebyshev-distance'}
          className="h-full"
        />
      ),
      keepMounted: true,
    },
    {
      id: 'tree',
      label: 'Search Tree',
      content: treeElements.length > 0 ? (
        <SVGAutoCanvas elements={treeElements} />
      ) : (
        <EmptyState
          title="No search tree yet"
          description="Step through the algorithm to build the exploration tree."
          className="bg-[var(--bg)]"
        />
      ),
    },
  ], [algorithmElements, stylesheet, step, runner, handleDemoSelect, treeElements]);

  // ── Title actions ────────────────────────────────────────────────────
  const titleActions = useMemo(() => (
    <TitleBarActionButton
      onClick={() => {
        const weighted = isWeightedAlgorithm;
        const { nodes, edges } = generateRandomGraph(6 + Math.floor(Math.random() * 5), 0.25, weighted);
        const ids = nodes.map(n => n.id);
        useEditorStore.getState().loadGraph(nodes, edges, ids[0], ids[ids.length - 1], false);
      }}
      icon={<Dice5 size={12} />}
      label="Randomize"
      title="Generate random graph"
    />
  ), [algo, isWeightedAlgorithm]);

  // ── Problem import handler ───────────────────────────────────────────
  const handleImport = useCallback((imported: unknown) => {
    const p = imported as GraphProblem;
    if (p?.graph?.nodes && p?.graph?.edges) {
      useEditorStore.getState().loadGraph(
        p.graph.nodes,
        p.graph.edges,
        p.startNode ?? 'A',
        p.goalNode ?? 'B',
        p.graph.directed ?? false,
      );
      if (p.heuristic?.id) {
        setHeuristicId(p.heuristic.id);
        const importedScale = Number(p.heuristic.params?.scale);
        setHeuristicScale(Number.isFinite(importedScale) && importedScale > 0 ? importedScale : 1);
      }
    }
  }, []);

  const updateNodeHeuristic = useCallback((nodeId: string, raw: string) => {
    if (raw.trim() === '') {
      updateNode(nodeId, { heuristic: undefined });
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    updateNode(nodeId, { heuristic: parsed });
  }, [updateNode]);

  const configPanel = useMemo(() => {
    const selectedNode = selectedIds.length === 1 ? editorNodes.find(n => n.id === selectedIds[0]) : null;
    const selectedEdge = !selectedNode && selectedIds.length === 1 ? editorEdges.find(e => e.id === selectedIds[0]) : null;

    if (selectedNode) {
      return (
        <ProblemConfigurator 
          title={`Node: ${selectedNode.label ?? selectedNode.id}`}
          onBack={() => setSelected([])}
        >
          <ConfigSection title="Properties">
            <div className="space-y-4">
               <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Label</p>
                  <input
                    type="text"
                    value={selectedNode.label ?? ''}
                    onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                    className="ui-input w-full px-2 py-1.5 font-mono"
                    placeholder={selectedNode.id}
                  />
               </div>
               <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Heuristic Value (h)</p>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedNode.heuristic ?? ''}
                    onChange={(e) => updateNodeHeuristic(selectedNode.id, e.target.value)}
                    className="ui-input w-full px-2 py-1.5 font-mono"
                    placeholder="0.0"
                  />
               </div>
               <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => useEditorStore.getState().setStartNode(selectedNode.id)}
                    className={cn(
                      "ui-btn w-full py-1.5 text-[10px] font-semibold uppercase tracking-wider",
                      editorStartId === selectedNode.id 
                        ? "ui-pill-purple border-[color:var(--pill-purple-border)] text-[var(--pill-purple-text)]"
                        : ""
                    )}
                  >
                    Set as Start
                  </button>
                  <button
                    onClick={() => useEditorStore.getState().setGoalNode(selectedNode.id)}
                    className={cn(
                      "ui-btn w-full py-1.5 text-[10px] font-semibold uppercase tracking-wider",
                      editorGoalId === selectedNode.id 
                        ? "ui-pill-success border-[color:var(--pill-success-border)] text-[var(--pill-success-text)]"
                        : ""
                    )}
                  >
                    Set as Goal
                  </button>
               </div>
            </div>
          </ConfigSection>
        </ProblemConfigurator>
      );
    }

    if (selectedEdge) {
      return (
        <ProblemConfigurator 
          title={`Edge: ${selectedEdge.id}`}
          onBack={() => setSelected([])}
        >
          <ConfigSection title="Properties">
            <div className="space-y-4">
               <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Weight (Cost)</p>
                  <input
                    type="number"
                    step={1}
                    value={selectedEdge.weight ?? 1}
                    onChange={(e) => useEditorStore.getState().updateEdge(selectedEdge.id, { weight: Number(e.target.value) })}
                    className="ui-input w-full px-2 py-1.5 font-mono"
                  />
               </div>
               <div className="text-[10px] text-[var(--text-3)] bg-[var(--surface-2)]/30 p-2 rounded border border-[var(--border)]">
                  Connects <span className="text-[var(--text-2)] font-mono">{selectedEdge.source}</span> and <span className="text-[var(--text-2)] font-mono">{selectedEdge.target}</span>
               </div>
            </div>
          </ConfigSection>
        </ProblemConfigurator>
      );
    }


    return (
      <ProblemConfigurator title="Global Config">
        <ConfigSection title="Heuristic Settings">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Algorithm</p>
              <p className="text-[12px] text-[var(--text-2)] font-mono">{algo}</p>
            </div>

            {isInformedAlgorithm && (
              <HeuristicConfigSection
                heuristicId={heuristicId}
                onHeuristicIdChange={(val) => setHeuristicId(val as HeuristicId)}
                heuristicOptions={INFORMED_HEURISTICS.map(h => ({ value: h.id, label: h.label }))}
                description={heuristicDefinition.description}
                heuristicScale={heuristicScale}
                onHeuristicScaleChange={setHeuristicScale}
                afterScale={heuristicId !== 'manual-node' && heuristicId !== 'zero' ? (
                  <InfoCard title="Caution: Spatial Reference" className="border-[var(--warning)]/30 border-l-2">
                    <div className="flex items-center gap-1.5 text-[var(--warning)]">
                      <Info size={10} />
                      <p className="text-[9px] uppercase font-bold tracking-widest">Coordinate-sensitive heuristic</p>
                    </div>
                    <p className="text-[10px] italic leading-relaxed text-[var(--text-3)]">
                      Geometric heuristics like <span className="font-mono text-[var(--text-2)]">{heuristicId.split('-')[0]}</span> depend on node coordinates.
                      You will need to <span className="font-semibold text-[var(--text-2)]">rearrange nodes on the canvas</span> to physically represent the distances you want.
                    </p>
                  </InfoCard>
                ) : null}
                footer={<InfoCard title="Cost Model"><p className="font-mono text-[11px] text-[var(--text)]">{evaluationFormula(algo)}</p></InfoCard>}
              />
            )}

            {!isInformedAlgorithm && (
              <InfoCard>
                <p className="text-[10px] text-[var(--text-2)] leading-relaxed">
                  This algorithm operates on unweighted graphs or ignores heuristic estimates.
                </p>
              </InfoCard>
            )}

            {algo === 'dls' && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Depth Limit</p>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={depthLimit}
                  onChange={(e) => setDepthLimit(Math.max(1, Number(e.target.value) || 1))}
                  className="ui-input w-full px-2 py-1.5 font-mono"
                />
              </div>
            )}

            {algo === 'weighted-astar' && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Inflation Weight (w)</p>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={weightedAStarWeight}
                  onChange={(e) => setWeightedAStarWeight(Math.max(1, Number(e.target.value) || 1))}
                  className="ui-input w-full px-2 py-1.5 font-mono"
                />
                <p className="mt-1 text-[9px] text-[var(--text-3)]">w=1 -&gt; optimal (A*). Higher = faster but suboptimal.</p>
              </div>
            )}

            {(algo === 'sma-star' || algo === 'smgs') && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Memory Limit</p>
                <input
                  type="number"
                  min={2}
                  max={512}
                  step={1}
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(Math.max(2, Math.floor(Number(e.target.value) || 2)))}
                  className="ui-input w-full px-2 py-1.5 font-mono"
                />
                <p className="mt-1 text-[9px] text-[var(--text-3)]">
                  {algo === 'smgs'
                    ? 'Maximum kernel size SMGS retains in sparse closed-memory before pruning kernel leaves.'
                    : 'Maximum number of states SMA* keeps in memory before pruning.'}
                </p>
              </div>
            )}
          </div>
        </ConfigSection>

        {/* Adjacency Table Section */}
        <ConfigSection title="Adjacency Table" defaultOpen={false}>
          <AdjacencyTable 
            showHeuristics={isInformedAlgorithm} 
            showWeights={isWeightedAlgorithm}
            heuristicId={heuristicId}
            heuristicScale={heuristicScale}
          />
        </ConfigSection>
      </ProblemConfigurator>
    );
  }, [algo, depthLimit, weightedAStarWeight, memoryLimit, isInformedAlgorithm, heuristicId, heuristicDefinition.description, heuristicScale, editorNodes, editorStartId, editorGoalId, editorEdges, selectedIds, updateNode, updateNodeHeuristic, setSelected]);

  // problemForActions: always includes positions for export/save, even if current algo run strips them.
  const fullProblem = useMemo(() => ({
    ...algoProblem,
    graph: new Graph({ 
      directed: editorIsDirected, 
      nodes: editorNodes, 
      edges: editorEdges 
    }),
  }), [algoProblem, editorIsDirected, editorNodes, editorEdges]);

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={algoProblem}
        problemForActions={fullProblem}
        category={runner?.meta.category ?? 'uninformed-search'}
        problemCategory="graph"
        onProblemImport={handleImport}
        tabs={tabs}
        titleActions={titleActions}
        configPanel={configPanel}
        defaultConfigOpen
        onDemoRequest={() => setDemoDialogOpen(true)}
      />
      <DemoProblemPicker
        algorithmCategory={runner?.meta.category ?? 'uninformed-search'}
        onSelect={handleDemoSelect}
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
      />
    </>
  );
}
