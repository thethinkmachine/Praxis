/**
 * Generic min-heap priority queue.
 * Items are [priority, value] pairs; lower priority = higher precedence.
 */
export class PriorityQueue<T> {
  private heap: [number, T][] = [];

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(item: T, priority: number): void {
    this.heap.push([priority, item]);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.isEmpty) return undefined;
    const top = this.heap[0][1];
    const last = this.heap.pop()!;
    if (!this.isEmpty) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.heap[0]?.[1];
  }

  peekPriority(): number | undefined {
    return this.heap[0]?.[0];
  }

  contains(predicate: (item: T) => boolean): boolean {
    return this.heap.some(([, v]) => predicate(v));
  }

  toArray(): T[] {
    return this.heap.map(([, v]) => v);
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent][0] <= this.heap[i][0]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left][0] < this.heap[smallest][0]) smallest = left;
      if (right < n && this.heap[right][0] < this.heap[smallest][0]) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
