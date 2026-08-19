import { Component, type ErrorInfo, type ReactNode } from "react";
import "./app-error-boundary.css";

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: Error | null; componentStack: string; copied: boolean };

function makeCrashReport(error: Error | null, componentStack: string) {
  return [
    "Localitfy renderer crash",
    `Time: ${new Date().toISOString()}`,
    `User agent: ${navigator.userAgent}`,
    "",
    error?.stack || error?.message || "Unknown renderer error",
    componentStack ? `\nComponent stack:\n${componentStack}` : ""
  ].filter(Boolean).join("\n");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: "", copied: false };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[localitfy renderer crash]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack || "" });
  }

  restart = async () => {
    try {
      const restarted = await window.localitfy?.restartApp?.();
      if (restarted) return;
    } catch {
      // Renderer reload is the final fallback when IPC itself is unavailable.
    }
    window.location.reload();
  };

  copyError = async () => {
    const copied = await copyText(makeCrashReport(this.state.error, this.state.componentStack));
    if (!copied) return;
    this.setState({ copied: true });
    window.setTimeout(() => this.setState({ copied: false }), 1800);
  };

  openLogs = async () => {
    try {
      const result = await window.localitfy?.openLogsFolder?.();
      if (result?.ok) return;
    } catch {
      // DevTools remains useful if opening the logs directory fails.
    }
    await window.localitfy?.openDevTools?.({ mode: "detach" }).catch(() => undefined);
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="appCrashBoundary" role="alert">
        <section className="appCrashCard">
          <span className="appCrashEyebrow">localtify recovery</span>
          <h1>Localitfy encountered an error</h1>
          <p>The renderer hit an unexpected error. Your library stays on disk; restart the app or copy the diagnostic details.</p>
          <pre className="appCrashMessage">{this.state.error.message || "Unknown renderer error"}</pre>
          <div className="appCrashActions">
            <button type="button" className="appCrashPrimary" onClick={this.restart}>Restart</button>
            <button type="button" onClick={this.copyError}>{this.state.copied ? "Copied" : "Copy error"}</button>
            <button type="button" onClick={this.openLogs}>Open logs</button>
          </div>
        </section>
      </main>
    );
  }
}
