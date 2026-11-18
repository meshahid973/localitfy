import { Component, type ReactNode, type ErrorInfo } from "react";

export class PageErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[localtify page error]", error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <section className="homeEmptyState" role="alert">
      <div><strong>This page couldn't open.</strong><span>Your music and player are still available. Try again or open another page.</span></div>
      <button type="button" className="softButton" onClick={() => this.setState({ error: false })}>Retry</button>
    </section>;
  }
}
