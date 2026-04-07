import type { AlgorithmRunner, AlgorithmStep } from '@/types';

export type EngineStatus = 'idle' | 'loaded' | 'running' | 'paused' | 'finished';

const MAX_STEPS = 10_000;
const DEFAULT_ASYNC_BATCH_SIZE = 200;

export interface EngineLoadAsyncOptions {
  batchSize?: number;
  shouldAbort?: () => boolean;
}

export class ExecutionEngine<TProblem = unknown, TState = unknown, THighlight = unknown, TResult = void> {
  private steps: AlgorithmStep<TState, THighlight>[] = [];
  private _currentIndex = -1;
  private _status: EngineStatus = 'idle';
  private _result: TResult | undefined = undefined;
  private _truncated = false;
  private _validationWarnings: string[] = [];

  get status(): EngineStatus { return this._status; }
  get currentIndex(): number { return this._currentIndex; }
  get totalSteps(): number { return this.steps.length; }
  get truncated(): boolean { return this._truncated; }
  get result(): TResult | undefined { return this._result; }
  get validationWarnings(): string[] { return this._validationWarnings; }

  get currentStep(): AlgorithmStep<TState, THighlight> | null {
    return this._currentIndex >= 0 ? this.steps[this._currentIndex] : null;
  }

  get isAtEnd(): boolean {
    return this._currentIndex === this.steps.length - 1;
  }

  get isAtStart(): boolean {
    return this._currentIndex <= 0;
  }

  private initializeLoad(
    runner: AlgorithmRunner<TProblem, TState, THighlight, TResult>,
    problem: TProblem,
  ): Generator<AlgorithmStep<TState, THighlight>, TResult, void> {
    const validation = runner.validate(problem);
    if (!validation.valid) {
      throw new Error(`Invalid problem: ${validation.errors.join(', ')}`);
    }
    this._validationWarnings = validation.warnings ?? [];

    this.steps = [];
    this._truncated = false;
    this._currentIndex = -1;
    this._result = undefined;

    return runner.run(problem);
  }

  private appendStep(step: AlgorithmStep<TState, THighlight>, start: number): void {
    const elapsed = performance.now() - start;
    this.steps.push({
      ...step,
      metrics: Array.isArray(step.metrics)
        ? [...step.metrics, { label: 'Elapsed MS', value: elapsed.toFixed(3), color: 'text-[var(--text-3)]', fullWidth: true }]
        : { ...step.metrics, elapsedMs: elapsed },
    });
  }

  load(runner: AlgorithmRunner<TProblem, TState, THighlight, TResult>, problem: TProblem): void {
    const start = performance.now();
    const gen = this.initializeLoad(runner, problem);

    while (true) {
      const next = gen.next();
      if (next.done) {
        this._result = next.value as TResult;
        break;
      }
      this.appendStep(next.value, start);
      if (this.steps.length >= MAX_STEPS) {
        this._truncated = true;
        break;
      }
    }

    this._status = 'loaded';
  }

  async loadAsync(
    runner: AlgorithmRunner<TProblem, TState, THighlight, TResult>,
    problem: TProblem,
    options: EngineLoadAsyncOptions = {},
  ): Promise<void> {
    const start = performance.now();
    const gen = this.initializeLoad(runner, problem);
    const batchSize = Math.max(1, options.batchSize ?? DEFAULT_ASYNC_BATCH_SIZE);
    let processedInBatch = 0;

    while (true) {
      if (options.shouldAbort?.()) {
        this.clear();
        return;
      }

      const next = gen.next();
      if (next.done) {
        this._result = next.value as TResult;
        this._status = 'loaded';
        return;
      }

      this.appendStep(next.value, start);
      processedInBatch += 1;

      if (this.steps.length >= MAX_STEPS) {
        this._truncated = true;
        this._status = 'loaded';
        return;
      }

      if (processedInBatch >= batchSize) {
        processedInBatch = 0;
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    }
  }

  stepForward(): AlgorithmStep<TState, THighlight> | null {
    if (this._currentIndex < this.steps.length - 1) {
      this._currentIndex++;
      this._status = 'running';
      return this.steps[this._currentIndex];
    }
    this._status = 'finished';
    return null;
  }

  stepBackward(): AlgorithmStep<TState, THighlight> | null {
    if (this._currentIndex > 0) {
      this._currentIndex--;
      this._status = 'paused';
      return this.steps[this._currentIndex];
    }
    return this._currentIndex === 0 ? this.steps[0] : null;
  }

  seekToStep(index: number): AlgorithmStep<TState, THighlight> | null {
    if (this.steps.length === 0) return null;
    this._currentIndex = Math.max(0, Math.min(index, this.steps.length - 1));
    this._status = 'paused';
    return this.steps[this._currentIndex];
  }

  jumpToStart(): AlgorithmStep<TState, THighlight> | null {
    return this.seekToStep(0);
  }

  jumpToEnd(): AlgorithmStep<TState, THighlight> | null {
    return this.seekToStep(this.steps.length - 1);
  }

  getAllSteps(): AlgorithmStep<TState, THighlight>[] {
    return this.steps;
  }

  getFinalMetrics() {
    return this.steps[this.steps.length - 1]?.metrics ?? null;
  }

  reset(): void {
    this._currentIndex = -1;
    this._status = 'loaded';
  }

  clear(): void {
    this.steps = [];
    this._currentIndex = -1;
    this._status = 'idle';
    this._result = undefined;
    this._truncated = false;
    this._validationWarnings = [];
  }
}
