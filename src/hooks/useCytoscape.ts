import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape, { type Core, type EventObject } from 'cytoscape';
import type { ElementDefinition, StylesheetStyle } from 'cytoscape';
// @ts-expect-error - no types
import dagre from 'cytoscape-dagre';
// @ts-expect-error - no types
import edgehandles from 'cytoscape-edgehandles';

// Register extensions once
let registered = false;
function registerExtensions() {
  if (!registered) {
    cytoscape.use(dagre);
    cytoscape.use(edgehandles);
    registered = true;
  }
}

interface UseCytoscapeOptions {
  elements?: ElementDefinition[];
  stylesheet?: StylesheetStyle[];
  layout?: cytoscape.LayoutOptions;
  onNodeClick?: (nodeId: string) => void;
  onNodeRightClick?: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDoubleClick?: (nodeId: string, position: { x: number; y: number }) => void;
  onEdgeClick?: (edgeId: string) => void;
  onEdgeRightClick?: (edgeId: string, position: { x: number; y: number }) => void;
  onEdgeDoubleClick?: (edgeId: string, position: { x: number; y: number }) => void;
  onBackgroundClick?: (position: { x: number; y: number }) => void;
  onEdgeAdded?: (sourceId: string, targetId: string) => void;
  onNodeMoved?: (nodeId: string, position: { x: number; y: number }) => void;
  autoFit?: boolean;
  /** Additional edge-draw validation beyond the default self-loop check (e.g. tree single-parent/no-cycle rules). */
  canConnect?: (sourceId: string, targetId: string) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EdgeHandlesInstance = any;

export function useCytoscape(containerRef: React.RefObject<HTMLDivElement>, options: UseCytoscapeOptions = {}) {
  const cyRef = useRef<Core | null>(null);
  const ehRef = useRef<EdgeHandlesInstance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [zoomLevel, setZoomLevel] = useState(1);

  // Mount once
  useEffect(() => {
    if (!containerRef.current) return;
    registerExtensions();

    const cy = cytoscape({
      container: containerRef.current,
      elements: options.elements ?? [],
      style: options.stylesheet ?? [],
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.1,
      maxZoom: 4,
    });

    cyRef.current = cy;

    // Initialise edgehandles on the instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eh: EdgeHandlesInstance = (cy as any).edgehandles({
      canConnect(sourceNode: cytoscape.NodeSingular, targetNode: cytoscape.NodeSingular) {
        if (sourceNode.same(targetNode)) return false;
        return optionsRef.current.canConnect?.(sourceNode.id(), targetNode.id()) ?? true;
      },
      edgeParams() {
        return { data: { weight: 1 } };
      },
    });
    ehRef.current = eh;

    cy.on('tap', 'node', (evt: EventObject) => {
      optionsRef.current.onNodeClick?.(evt.target.id());
    });

    cy.on('cxttap', 'node', (evt: EventObject) => {
      const pos = evt.renderedPosition ?? evt.position;
      optionsRef.current.onNodeRightClick?.(evt.target.id(), { x: pos.x, y: pos.y });
    });

    cy.on('dbltap', 'node', (evt: EventObject) => {
      const pos = evt.renderedPosition ?? evt.position;
      optionsRef.current.onNodeDoubleClick?.(evt.target.id(), { x: pos.x, y: pos.y });
    });

    cy.on('tap', 'edge', (evt: EventObject) => {
      optionsRef.current.onEdgeClick?.(evt.target.id());
    });

    cy.on('cxttap', 'edge', (evt: EventObject) => {
      const pos = evt.renderedPosition ?? evt.position;
      optionsRef.current.onEdgeRightClick?.(evt.target.id(), { x: pos.x, y: pos.y });
    });

    cy.on('dbltap', 'edge', (evt: EventObject) => {
      const pos = evt.renderedPosition ?? evt.position;
      optionsRef.current.onEdgeDoubleClick?.(evt.target.id(), { x: pos.x, y: pos.y });
    });

    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        const pos = evt.position;
        optionsRef.current.onBackgroundClick?.({ x: pos.x, y: pos.y });
      }
    });

    // edgehandles complete event: an edge was drawn
    cy.on('ehcomplete', (_evt: EventObject, sourceNode: cytoscape.NodeSingular, targetNode: cytoscape.NodeSingular, addedEdge: cytoscape.EdgeSingular) => {
      // Remove the auto-added edge (we'll let the store own the data)
      addedEdge.remove();
      optionsRef.current.onEdgeAdded?.(sourceNode.id(), targetNode.id());
    });

    // Node drag-free: snap to grid and propagate position back to store
    cy.on('dragfree', 'node', (evt: EventObject) => {
      const pos = evt.target.position();
      const snappedX = Math.round(pos.x / 20) * 20;
      const snappedY = Math.round(pos.y / 20) * 20;
      evt.target.position({ x: snappedX, y: snappedY });
      optionsRef.current.onNodeMoved?.(evt.target.id(), { x: snappedX, y: snappedY });
    });

    // Track zoom level changes
    cy.on('zoom', () => {
      setZoomLevel(cy.zoom());
    });

    return () => {
      eh.destroy();
      cy.destroy();
      cyRef.current = null;
      ehRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update stylesheet
  const updateStylesheet = useCallback((stylesheet: StylesheetStyle[]) => {
    cyRef.current?.style(stylesheet as unknown as cytoscape.StylesheetCSS[]);
  }, []);

  // Diff-patch elements (key performance feature - never re-mount)
  const updateElements = useCallback((elements: ElementDefinition[], layout?: cytoscape.LayoutOptions) => {
    const cy = cyRef.current;
    if (!cy) return;

    const newIds = new Set(elements.map(el => el.data.id as string));

    // Remove elements not in new set
    cy.elements().forEach(el => {
      if (!newIds.has(el.id())) el.remove();
    });

    // Add or update elements
    elements.forEach(el => {
      const id = el.data.id as string;
      const existing = cy.getElementById(id);
      if (existing.length === 0) {
        cy.add(el);
      } else {
        // Update data
        existing.data(el.data);
        // Update classes — always sync, even when empty/undefined (clears stale classes)
        existing.classes(el.classes ?? '');
        // Update position for nodes
        if (el.position && existing.isNode()) {
          // Only set position if it's different to avoid layout fighting
          const curr = existing.position();
          if (Math.abs(curr.x - el.position.x) > 1 || Math.abs(curr.y - el.position.y) > 1) {
            existing.position(el.position);
          }
        }
      }
    });

    if (layout) {
      cy.layout(layout).run();
    }

    if (optionsRef.current.autoFit) {
      cy.fit(undefined, 50);
    }
  }, []);

  const fit = useCallback((padding?: number) => {
    cyRef.current?.fit(undefined, padding ?? 50);
  }, []);

  const resetView = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  const enableEdgeDrawMode = useCallback(() => {
    ehRef.current?.enableDrawMode();
  }, []);

  const disableEdgeDrawMode = useCallback(() => {
    ehRef.current?.disableDrawMode();
  }, []);

  return { cyRef, zoomLevel, updateElements, updateStylesheet, fit, resetView, enableEdgeDrawMode, disableEdgeDrawMode };
}
