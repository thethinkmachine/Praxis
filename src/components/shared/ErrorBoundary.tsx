import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches rendering errors in its subtree.
 * Displays a minimal fallback UI and optionally reports to a callback.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
          <div className="text-sm font-semibold text-[var(--text)]">
            Something went wrong
          </div>
          <div className="text-xs text-[var(--text-3)] max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred in this panel.'}
          </div>
          <button
            onClick={this.handleRetry}
            className="mt-2 text-xs px-3 py-1.5 rounded bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
