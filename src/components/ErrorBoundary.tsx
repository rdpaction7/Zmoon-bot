import React from "react";

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a single broken component never leaves the user
 * with a blank white page. Data-layer failures are handled by the pages
 * themselves, so this is the last line of defence.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  private get path() {
    return typeof window === "undefined" ? "" : window.location.pathname;
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[skillswap] render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="shell">
        <div className="card card-pad error-boundary">
          <span className="eyebrow">Something broke</span>
          <h1>This page hit an unexpected error</h1>
          <p className="muted small">
            Page: <code>{this.path}</code>
          </p>
          <p className="muted">
            The rest of SkillSwap is still fine. Reload to get back to a working view — if it keeps
            happening, the error below helps track it down.
          </p>
          <pre className="error-boundary-detail">{this.state.error.message}</pre>
          <div className="row">
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </button>
            <a className="btn btn-secondary" href="/">
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
