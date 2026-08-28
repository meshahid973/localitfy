import "./index.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";

/* Explicit feature-style manifest. Keep feature ownership visible and auditable. */
import "./shared/ui/view-ui.css";
import "./features/library/library.css";
import "./features/albums/albums.css";
import "./features/playlists/playlists.css";
import "./features/covers/covers.css";
import "./features/downloads/downloads.css";
import "./features/analytics/analytics.css";

/* Performance overrides intentionally stay last in the renderer cascade. */
import "./features/shell/performance.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
