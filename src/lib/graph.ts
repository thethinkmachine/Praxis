import type { GraphData, GraphNode, GraphEdge } from '@/types/problem';

/**
 * Adjacency-list graph.
 * The problem domain stores graphs in this format; adapters convert to Cytoscape.
 */
export class Graph {
  private nodeMap = new Map<string, GraphNode>();
  private edgeMap = new Map<string, GraphEdge>();
  private adjList = new Map<string, Map<string, { weight: number; edgeId: string }>>();
  readonly directed: boolean;

  constructor(data?: GraphData) {
    this.directed = data?.directed ?? false;
    if (data) {
      data.nodes.forEach(n => this.addNode(n));
      data.edges.forEach(e => this.addEdge(e));
    }
  }

  addNode(node: GraphNode): void {
    this.nodeMap.set(node.id, node);
    if (!this.adjList.has(node.id)) {
      this.adjList.set(node.id, new Map());
    }
  }

  removeNode(id: string): void {
    this.nodeMap.delete(id);
    this.adjList.delete(id);
    // Remove all edges involving this node
    for (const [eid, e] of this.edgeMap) {
      if (e.source === id || e.target === id) {
        this.edgeMap.delete(eid);
        this.adjList.get(e.source)?.delete(e.target);
        if (!this.directed) this.adjList.get(e.target)?.delete(e.source);
      }
    }
  }

  addEdge(edge: GraphEdge): void {
    this.edgeMap.set(edge.id, edge);
    if (!this.adjList.has(edge.source)) this.adjList.set(edge.source, new Map());
    if (!this.adjList.has(edge.target)) this.adjList.set(edge.target, new Map());
    this.adjList.get(edge.source)!.set(edge.target, { weight: edge.weight, edgeId: edge.id });
    if (!this.directed) {
      this.adjList.get(edge.target)!.set(edge.source, { weight: edge.weight, edgeId: edge.id });
    }
  }

  removeEdge(id: string): void {
    const e = this.edgeMap.get(id);
    if (!e) return;
    this.edgeMap.delete(id);
    this.adjList.get(e.source)?.delete(e.target);
    if (!this.directed) this.adjList.get(e.target)?.delete(e.source);
  }

  hasNode(id: string): boolean {
    return this.nodeMap.has(id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodeMap.get(id);
  }

  getNeighbors(id: string): string[] {
    return [...(this.adjList.get(id)?.keys() ?? [])];
  }

  getEdgeWeight(from: string, to: string): number {
    return this.adjList.get(from)?.get(to)?.weight ?? 1;
  }

  getEdgeId(from: string, to: string): string | undefined {
    return this.adjList.get(from)?.get(to)?.edgeId;
  }

  getNodes(): GraphNode[] {
    return [...this.nodeMap.values()];
  }

  getEdges(): GraphEdge[] {
    return [...this.edgeMap.values()];
  }

  toData(): GraphData {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
      directed: this.directed,
    };
  }

  static fromData(data: GraphData): Graph {
    return new Graph(data);
  }
}
