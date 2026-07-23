import "./tauriCompatibilityBridge";
import "./index.css";
import { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

type RootErrorBoundaryState = {
  error: Error | null;
};

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[localtify] Renderer failed during startup.", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "32px",
          background: "#09090d",
          color: "#f7f7fb",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        <section style={{ width: "min(680px, 100%)", display: "grid", gap: "14px" }}>
          <p style={{ margin: 0, opacity: 0.7, fontSize: "13px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            localtify Tauri migration
          </p>
          <h1 style={{ margin: 0, fontSize: "28px" }}>The renderer could not finish starting.</h1>
          <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.82 }}>
            The error is now visible instead of leaving a black window. Copy the message below when reporting it.
          </p>
          <pre
            style={{
              margin: 0,
              padding: "16px",
              overflow: "auto",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              whiteSpace: "pre-wrap"
            }}
          >
            {this.state.error.stack || this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              width: "fit-content",
              minHeight: "40px",
              padding: "0 16px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.1)",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Reload localtify
          </button>
        </section>
      </main>
    );
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
