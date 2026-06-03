import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time crashes anywhere in the tree
 * so a single bad component does not white-screen the whole app. Per-panel
 * boundaries should be added inside TripWorkspace as a follow-up (Phase A6).
 *
 * In production this is also the hook point for Sentry / PostHog error
 * reporting (Phase A5) — wire `componentDidCatch` to your observability
 * sink when that is added.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="space-y-2">
          <p className="font-serif text-2xl text-foreground">Something went sideways.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The Concierge hit an unexpected error. Reloading usually clears it. If the
            problem persists, your last changes are still saved.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-sm border border-foil/40 bg-foil/10 px-6 py-2 text-sm uppercase tracking-wider text-foreground transition hover:bg-foil/20"
        >
          Reload
        </button>
      </div>
    );
  }
}

export default AppErrorBoundary;