import type { ReactNode } from "react";
import { localtifyLogo } from "../../core/app.constants";
import { WindowCloseIcon, WindowMinimizeIcon } from "../../shared/ui/LocaltifyViewUi";

export default function TitleBar({ mini = false, children }: { mini?: boolean; children?: ReactNode }) {
  function handleTitleDoubleClick() {
    if (!mini) window.localitfy.toggleMaximizeWindow();
  }

  return (
    <header className={mini ? "titleBar miniTitleBar" : "titleBar"}>
      <div className="titleDrag" onDoubleClick={handleTitleDoubleClick} title="drag to move localtify">
        <img className="titleLogo titleLogoImage" src={localtifyLogo} alt="" width={22} height={22} loading="eager" decoding="async" fetchPriority="high" draggable={false} aria-hidden="true" />
        <span>localtify</span>
      </div>

      {!mini && children ? (
        <div className="titleBarUpdateSlot" aria-label="localtify update notice">
          {children}
        </div>
      ) : null}

      <div className="windowButtons">
        <button type="button" onClick={() => window.localitfy.minimizeWindow()} aria-label="Minimize window"><WindowMinimizeIcon /></button>
        {!mini ? (
          <button type="button" className="maxWin" onClick={() => window.localitfy.toggleMaximizeWindow()} aria-label="Maximize or restore window">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" focusable="false">
              <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        ) : null}
        <button type="button" className="closeWin" onClick={() => window.localitfy.closeWindow()} aria-label="Close window"><WindowCloseIcon /></button>
      </div>
    </header>
  );
}
