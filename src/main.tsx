import "./index.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";

/* Shared UI and temporary structural foundations only. Page designs are rebuilt independently. */
import "./shared/ui/view-ui.css";
import "./styles/page-foundation.css";
import "./styles/view-shell.css";

/* Performance overrides intentionally stay last in the renderer cascade. */
import "./features/shell/performance.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
