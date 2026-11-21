import "../features/updates/updates.css";
import { isAndroidApp } from "./platform";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentType } from "react";
import type { Transition } from "motion/react";
import { AlertCircle, CheckCircle2, Download, RefreshCcw, X } from "lucide-react";
import type { UpdatePromptState } from "../features/updates/update.types";

export type UpdateIslandProps = {
  show:boolean;updatePrompt:UpdatePromptState;appVersion:string;reducedMotion:boolean;
  yukariUpdateImage?:string;enterSpring?:Transition;childSpring?:Transition;
  titleForPrompt?:(prompt:UpdatePromptState)=>string;
  StatusIcon?:ComponentType<{status:string}>;CloseIcon?:ComponentType;
  onDownload:()=>void;onInstall:()=>void;onCheckAgain:()=>void;onDismiss:()=>void;onWhatsNew:()=>void;
};
const size=(bytes?:number)=>bytes&&bytes>0?(bytes/1048576).toFixed(1)+" MB":"";
export default function UpdateIsland({show,updatePrompt,appVersion,reducedMotion,onDownload,onInstall,onCheckAgain,onDismiss,onWhatsNew}:UpdateIslandProps){
  const status=updatePrompt.status,version=updatePrompt.version||appVersion;
  const pct=Math.max(0,Math.min(100,Number(updatePrompt.percent)||0));
  const downloading=status==="downloading",available=status==="available",downloaded=status==="downloaded",error=status==="error";
  const title=available?"Localtify "+version+" is available":downloaded?"Update ready to install":downloading?"Downloading update — "+Math.round(pct)+"%":error?"Update check failed":"Checking for updates…";
  const detail=available?"A newer version is ready"+(updatePrompt.manualOnly?" · manual install":""):downloaded?"Restart when you're ready":downloading?[size(updatePrompt.downloadedBytes),size(updatePrompt.totalBytes)].filter(Boolean).join(" / "):"";
  return <AnimatePresence initial={false}>{show?<motion.section
    key="localtify-update-banner" className={"localtifyUpdateBanner "+status} role="status" aria-live="polite"
    initial={reducedMotion?false:{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={reducedMotion?{opacity:0}:{opacity:0,y:-6}} transition={{duration:reducedMotion?0:0.16}}>
    <div className="localtifyUpdateBannerMain">
      {downloaded?<CheckCircle2 size={17}/>:error?<AlertCircle size={17}/>:downloading?<Download size={17}/>:<RefreshCcw size={17}/>}
      <div className="localtifyUpdateBannerText"><strong>{title}</strong>{detail?<span>{detail}</span>:null}</div>
    </div>
    <div className="localtifyUpdateBannerActions">
      {(available||downloaded)?<button type="button" onClick={onWhatsNew}>What's new</button>:null}
      {available?<button type="button" onClick={onDownload}>{updatePrompt.manualOnly?(isAndroidApp()?"Get APK":"Get AppImage"):"Download"}</button>:null}
      {downloaded?<button type="button" onClick={onInstall}>Restart to update</button>:null}
      {error?<button type="button" onClick={onCheckAgain}>Retry</button>:null}
      {!downloading?<button type="button" onClick={onDismiss} aria-label="Dismiss update notice"><X size={15}/></button>:null}
    </div>
    {downloading?<span className="localtifyUpdateBannerProgress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Update download progress" style={{width:pct+"%"}}/>:null}
  </motion.section>:null}</AnimatePresence>;
}
