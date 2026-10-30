import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NavigationHistory } from "./useNavigationHistory";
import "./navigation-history.css";
import { localtifyLogo } from "../../core/app.constants";
import { WindowCloseIcon, WindowMinimizeIcon } from "../../shared/ui/LocaltifyViewUi";

export default function TitleBar({
  mini = false,
  showWindowButtons = true,
  history,
  children
}: {
  mini?: boolean;
  showWindowButtons?: boolean;
  /** Back/forward buttons, like a browser. */
  history?: Pick<NavigationHistory, "canGoBack" | "canGoForward" | "back" | "forward">;
  children?: ReactNode;
}) {
  const mac = /mac/i.test(navigator.platform);
  function handleTitleDoubleClick() {
    if (!mini) window.localitfy.toggleMaximizeWindow();
  }

  return (
    <header className={mini ? "titleBar miniTitleBar" : "titleBar"}>
      <div className="titleDrag" onDoubleClick={handleTitleDoubleClick} title="drag to move localtify">
        <img className="titleLogo titleLogoImage" src={localtifyLogo} alt="" width={22} height={22} loading="eager" decoding="async" fetchPriority="high" draggable={false} aria-hidden="true" />
        <span>localtify</span>
      </div>

      {!mini && history ? (
        <nav className="titleHistoryNav" aria-label="history">
          <button type="button" onClick={history.back} disabled={!history.canGoBack} aria-label="Go back" title={`Go back (${mac ? "⌘[" : "Alt+←"})`}>
            <ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button type="button" onClick={history.forward} disabled={!history.canGoForward} aria-label="Go forward" title={`Go forward (${mac ? "⌘]" : "Alt+→"})`}>
            <ChevronRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </nav>
      ) : null}

      {!mini && children ? (
        <div className="titleBarUpdateSlot" aria-label="localtify update notice">
          {children}
        </div>
      ) : null}

      {showWindowButtons ? <div className="windowButtons">
        <button type="button" onClick={() => window.localitfy.minimizeWindow()} aria-label="Minimize window"><WindowMinimizeIcon /></button>
        {!mini ? (
          <button type="button" className="maxWin" onClick={() => window.localitfy.toggleMaximizeWindow()} aria-label="Maximize or restore window">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" focusable="false">
              <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        ) : null}
        <button type="button" className="closeWin" onClick={() => window.localitfy.closeWindow()} aria-label="Close window"><WindowCloseIcon /></button>
      </div> : null}
    </header>
  );
}
