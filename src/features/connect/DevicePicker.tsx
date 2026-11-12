import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Laptop, MonitorSmartphone, Smartphone } from "lucide-react";
import { computerName } from "../../app/platform";
import type { ConnectControls } from "./usePlaybackConnect";
import "./connect.css";

function connectionText(status: ConnectControls["status"]) {
  if (status === "connecting") return `Connecting to your ${computerName()}…`;
  if (status === "offline") return `Your ${computerName()} isn't reachable. Check that both are on the same Wi-Fi and localtify is open there`;
  if (status === "unsupported") return `Update localtify on your ${computerName()} to control playback from here`;
  return "";
}

/** "Play on": lists this device and the connected ones, and moves playback to the one picked. */
export function DevicePicker({ controls, variant }: { controls: ConnectControls; variant: "bar" | "chip" }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [open]);

  // The player bar clips its contents, so the menu is drawn in the app layer, just above the button.
  useLayoutEffect(() => {
    if (!open) return;
    const placeMenu = () => {
      const button = rootRef.current?.getBoundingClientRect();
      const layer = (document.querySelector(".app") || document.body).getBoundingClientRect();
      if (!button) return;
      const bottom = layer.bottom - button.top + 10;
      // Half the chip menu's width (min(300px, 100vw - 32px)) plus a 16px margin keeps it on screen.
      const half = Math.min(150, window.innerWidth / 2 - 16) + 16;
      setPlace(variant === "bar"
        ? { right: Math.max(8, layer.right - button.right), bottom }
        : { left: Math.min(Math.max(button.left + button.width / 2 - layer.left, half), layer.width - half), bottom });
    };
    placeMenu();
    window.addEventListener("resize", placeMenu);
    return () => window.removeEventListener("resize", placeMenu);
  }, [open, variant]);

  const playingOn = controls.active || controls.self;
  const status = connectionText(controls.status);
  const title = controls.remoteName ? `playing on ${controls.remoteName}` : status || "choose where to play";

  return (
    <div className={`connectPicker connectPicker-${variant}`} ref={rootRef}>
      <button
        type="button"
        className={`${variant === "bar" ? "playerQueueButton" : "phoneChip"} connectButton ${controls.remoteName ? "active isRemote" : ""} ${status ? "isOffline" : ""}`}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={title}
        title={title}
      >
        <MonitorSmartphone className="playerControlIcon" size={17} strokeWidth={2.2} aria-hidden="true" />
        {variant === "chip" ? <span>{controls.remoteName ? `on ${controls.remoteName}` : "devices"}</span> : null}
      </button>
      {open ? createPortal(
        <div className={`connectMenu connectMenu-${variant}`} role="menu" aria-label="play on" ref={menuRef} style={place}
          onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
          <strong className="connectMenuTitle">play on</strong>
          {controls.peers.map((peer) => {
            const Icon = peer.kind === "computer" ? Laptop : Smartphone;
            const current = peer.id === playingOn;
            return (
              <button key={peer.id} type="button" role="menuitemradio" aria-checked={current} className={`connectMenuItem ${current ? "isCurrent" : ""}`}
                onClick={() => { controls.transfer(peer.id); setOpen(false); }}>
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>
                  <strong>{controls.label(peer)}</strong>
                  {current && controls.active ? <small>now playing</small> : null}
                </span>
              </button>
            );
          })}
          {status ? <p className="connectMenuStatus">{status}</p> : null}
        </div>,
        document.querySelector(".app") || document.body
      ) : null}
    </div>
  );
}
