import "./index.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { isAndroidApp } from "./app/platform";

/* Global typography, design tokens, and theme variables. */
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/tokens.css";
import "./styles/themes.css";

/* Shared renderer primitives. */
import "./shared/ui/view-ui.css";

/* Performance overrides intentionally stay last in the renderer cascade. */
import "./features/shell/performance.css";

const render = () => ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

// The Android app has no Electron preload; its bridge loads first, and only there.
if (isAndroidApp()) void import("./platform/android").then((android) => android.installAndroidBridge()).then(render);
else render();
