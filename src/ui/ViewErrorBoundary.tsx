import { Component, type ErrorInfo, type ReactNode } from "react";
import "./view-error-boundary.css";

type ViewErrorBoundaryProps = {
  name?: string;
  children: ReactNode;
  fallback?: ReactNode;
};

type ViewErrorBoundaryState = {
  error: Error | null;
};

export default class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[localtify view error]", this.props.name || "view", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <section className="viewErrorBoundaryCard" role="alert">
        <span>view crashed</span>
        <strong>{this.props.name || "This view"} had a problem.</strong>
        <small>{this.state.error.message || "Something went wrong while rendering this section."}</small>
        <button type="button" onClick={this.reset}>try again</button>
      </section>
    );
  }
}
