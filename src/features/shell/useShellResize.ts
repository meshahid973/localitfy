import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import type { Settings } from "../settings/settings.types";
import { clamp } from "../../shared/utils/format";

type ResizeKey = "playerSize" | "sidebarWidth";
const layouts = {
  playerSize: {axis:"y",direction:-1,min:74,max:168,fallback:108,property:"--player-size-live",className:"isResizingPlayer"},
  sidebarWidth: {axis:"x",direction:1,min:184,max:340,fallback:249,property:"--sidebar-width-live",className:"isResizingSidebar"}
} as const;

type Options = {
  appRootRef: {current:HTMLElement|null};
  settingsRef: {current:Settings};
  discordSettingsRef: {current:Settings};
  setSettings: (value:Settings)=>void;
  saveSettingsSafely: (value:Settings)=>Promise<void>;
};

/** One pointer session owns both resize controls, their RAF, handlers and transient CSS. */
export function useShellResize({appRootRef,settingsRef,discordSettingsRef,setSettings,saveSettingsSafely}:Options) {
  const abandon = useRef<(() => void)|null>(null);
  const settle = useRef<(() => void)|null>(null);
  useEffect(()=>()=>{abandon.current?.();settle.current?.();},[]);

  function start(event:PointerEvent<HTMLButtonElement>,key:ResizeKey) {
    event.preventDefault();
    abandon.current?.();
    settle.current?.();
    const config=layouts[key],handle=event.currentTarget,root=appRootRef.current;
    const pointer=event.pointerId;
    const at=(sample:{clientX:number;clientY:number})=>config.axis==="x"?sample.clientX:sample.clientY;
    const origin=at(event);
    const initial=clamp(Number(discordSettingsRef.current[key]||settingsRef.current[key]||config.fallback),config.min,config.max);
    let size=initial, frame:number|null=null,done=false;
    const paint=()=>{frame=null;root?.style.setProperty(config.property,`${size}px`);};
    function finish(commit:boolean) {
      if(done)return;
      done=true;abandon.current=null;
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",release);
      window.removeEventListener("pointercancel",release);
      window.removeEventListener("keydown",keyDown);
      document.body.classList.remove(config.className,"localitfyNoSelect");
      if(frame!==null){window.cancelAnimationFrame(frame);frame=null;}
      try{if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer);}catch{}
      if(!commit){root?.style.removeProperty(config.property);return;}
      paint();
      const next={...settingsRef.current,[key]:size};
      discordSettingsRef.current=next;
      settingsRef.current=next;
      setSettings(next);
      void saveSettingsSafely(next);
      const clear=()=>{root?.style.removeProperty(config.property);settle.current=null;};
      const timer=window.setTimeout(clear,90);
      settle.current=()=>{window.clearTimeout(timer);clear();};
    }
    function move(sample:globalThis.PointerEvent) {
      if(sample.pointerId!==pointer)return;
      size=Math.round(clamp(initial+config.direction*(at(sample)-origin),config.min,config.max));
      if(frame===null)frame=window.requestAnimationFrame(paint);
    }
    function release(sample:globalThis.PointerEvent) {if(sample.pointerId===pointer)finish(true);}
    function keyDown(sample:KeyboardEvent) {if(sample.key==="Escape"){size=initial;finish(true);}}
    document.body.classList.add(config.className,"localitfyNoSelect");
    paint();
    try{handle.setPointerCapture(pointer);}catch{}
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerup",release);
    window.addEventListener("pointercancel",release);
    window.addEventListener("keydown",keyDown);
    abandon.current=()=>finish(false);
  }

  return {startPlayerResize:(event:PointerEvent<HTMLButtonElement>)=>start(event,"playerSize"),
    startSidebarResize:(event:PointerEvent<HTMLButtonElement>)=>start(event,"sidebarWidth")};
}
