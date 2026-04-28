import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** If true, show a compact inline error instead of full-page */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Global React error boundary.
 *
 * Catches unhandled errors (including Convex query failures that throw
 * inside `useQuery`) and renders a user-friendly fallback instead of a
 * blank white screen. Place around route groups or individual pages.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const message = this.state.error?.message ?? "An unexpected error occurred.";
    // Strip Convex internal prefix for cleaner display
    const cleanMessage = message
      .replace(/^\[CONVEX [A-Z_]+\(.*?\)\]\s*/, "")
      .replace(/^Uncaught ConvexError:\s*/, "");

    if (this.props.inline) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
          <p className="text-sm font-medium text-red-800">Something went wrong</p>
          <p className="mt-1 text-xs text-red-600">{cleanMessage}</p>
          <button
            onClick={this.handleRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-[#1d2939]">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#667085]">
              {cleanMessage}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 text-sm font-medium text-[#344054] shadow-sm transition-colors hover:bg-[#f9fafb]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
