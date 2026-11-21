import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { isAndroidApp } from "../../app/platform";
import type { AppToastKind } from "../shell/view.types";
import { APP_VERSION, WHATS_NEW_SEEN_KEY, UPDATE_LEAVE_ALONE_PREFIX, defaultUpdatePrompt } from "./update.constants";
import type { AutoUpdateEvent, UpdatePromptState } from "./update.types";
import { friendlyUpdateError, updateWasLeftAlone } from "./update.utils";
import { fetchOfficialAndroidRelease, compareStableVersions, ANDROID_RELEASE_PREFIX } from "./androidRelease";

type UpdatesControllerOptions = {
  ready: boolean;
  autoUpdateEnabled: boolean;
  autoUpdateNotifyOnly: boolean;
  setStatusText: Dispatch<SetStateAction<string>>;
  showAppToast: (message: string, kind?: AppToastKind) => void;
};
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const LAST_CHECK_KEY = "localitfy.updateLastSuccessfulCheckAt";

export function useUpdatesController({ ready,autoUpdateEnabled,autoUpdateNotifyOnly,setStatusText,showAppToast }: UpdatesControllerOptions) {
  const [updatePrompt,setUpdatePrompt] = useState<UpdatePromptState>(defaultUpdatePrompt);
  const [whatsNewOpen,setWhatsNewOpen] = useState(false);
  const [whatsNewVersion,setWhatsNewVersion] = useState(APP_VERSION);
  const [whatsNewReleaseNotes,setWhatsNewReleaseNotes] = useState("");
  const [lastUpdateCheckedLabel,setLastUpdateCheckedLabel] = useState(()=>{
    try { const timestamp=Number(window.localStorage.getItem(LAST_CHECK_KEY)||0); return timestamp?new Date(timestamp).toLocaleString():"Not checked yet"; }
    catch { return "Not checked yet"; }
  });
  const notifyOnlyRef=useRef(autoUpdateNotifyOnly);
  const downloadAttemptedRef=useRef(new Set<string>());
  const lastAttemptRef=useRef(0);
  const checkingRef=useRef(false);
  const failureCountRef=useRef(0);
  const retryRef=useRef<number|null>(null);
  notifyOnlyRef.current=autoUpdateNotifyOnly;

  const applyEvent=useCallback((payload:AutoUpdateEvent)=>{
    if(!payload || typeof payload!=="object")return;
    const version=payload.version||"";
    const checkedAt=Number(payload.checkedAt||0);
    if(checkedAt>0 && Number.isFinite(checkedAt)) {
      setLastUpdateCheckedLabel(new Date(checkedAt).toLocaleString());
      try { window.localStorage.setItem(LAST_CHECK_KEY,String(checkedAt)); } catch {}
    }
    if(payload.type==="idle"||payload.type==="backup")return;
    if(payload.type==="checking") {
      if(!payload.silent) setUpdatePrompt(old=>old.status==="downloaded"?old:{...defaultUpdatePrompt,status:"checking",message:"Checking for updates..."});
      return;
    }
    if(payload.type==="available") {
      const next:UpdatePromptState={visible:!updateWasLeftAlone(version),status:"available",version,percent:0,
        message:payload.message||"A new Localtify version is available.",error:"",
        releaseNotes:payload.releaseNotes||"",manualOnly:payload.manualOnly,downloadUrl:payload.downloadUrl,checkedAt};
      setUpdatePrompt(old=>old.status==="downloaded"&&old.version===version?old:next);
      if(!payload.manualOnly && !notifyOnlyRef.current && !downloadAttemptedRef.current.has(version) &&
          !updateWasLeftAlone(version) && window.localitfy.downloadUpdate) {
        downloadAttemptedRef.current.add(version);
        void window.localitfy.downloadUpdate()
          .then(started=>{
            if(started)return;
            downloadAttemptedRef.current.delete(version);
            setUpdatePrompt(old=>old.version===version && old.status==="downloading"
              ? {...old,visible:true,status:"error",message:"Update download failed.",error:"Try again from Updates settings."}
              : old);
          })
          .catch(()=>{
            downloadAttemptedRef.current.delete(version);
            setUpdatePrompt(old=>old.version===version
              ? {...old,visible:true,status:"error",message:"Update download failed.",error:"Try again."}
              : old);
          });
      }
      return;
    }
    if(payload.type==="downloading") {
      setUpdatePrompt(old=>({...old,visible:true,status:"downloading",version:version||old.version,
        percent:Math.min(100,Math.max(0,Number(payload.percent||0))),message:payload.message||"Downloading update…",
        error:"",downloadedBytes:payload.downloadedBytes,totalBytes:payload.totalBytes,
        speedBytesPerSecond:payload.speedBytesPerSecond}));
      return;
    }
    if(payload.type==="downloaded") {
      setUpdatePrompt(old=>({...old,visible:!updateWasLeftAlone(version||old.version),status:"downloaded",version:version||old.version,
        percent:100,message:"Update ready. Restart to install.",error:"",releaseNotes:payload.releaseNotes||old.releaseNotes}));
      return;
    }
    if(payload.type==="not-available") {
      setUpdatePrompt(old=>old.status==="downloading"||old.status==="downloaded"?old:defaultUpdatePrompt);
      if(!payload.silent)setStatusText("Localtify is up to date.");
      return;
    }
    if(payload.type==="error") {
      if(payload.silent)return; // Background network failures must not become false update banners.
      const message=friendlyUpdateError(payload.error||payload.message);
      setUpdatePrompt(old=>({...old,visible:true,status:"error",message,error:message,percent:0}));
      showAppToast("Update check failed","error");
      return;
    }
    if(payload.type==="dev"&&!payload.silent) {
      setUpdatePrompt(defaultUpdatePrompt);
      setStatusText("Updates are available in packaged apps.");
    }
  },[setStatusText,showAppToast]);

  // Subscribing before loading the main-process snapshot prevents missing a download event while mounting.
  useEffect(()=>{
    if(isAndroidApp()||!window.localitfy.onAutoUpdate)return;
    let received=false,active=true;
    const off=window.localitfy.onAutoUpdate(payload=>{received=true;applyEvent(payload);});
    void window.localitfy.getUpdateState?.().then(state=>{if(active&&!received)applyEvent(state);}).catch(()=>undefined);
    return()=>{active=false;off();};
  },[applyEvent]);

  useEffect(()=>{
    if(!ready)return;
    try {if(window.localStorage.getItem(WHATS_NEW_SEEN_KEY)===APP_VERSION)return;}
    catch {return;}
    const timer=window.setTimeout(()=>{setWhatsNewVersion(APP_VERSION);setWhatsNewReleaseNotes("");setWhatsNewOpen(true);},420);
    return()=>window.clearTimeout(timer);
  },[ready]);

  const checkAndroid=useCallback(async(silent:boolean)=>{
    try {
      const release=await fetchOfficialAndroidRelease();
      const checkedAt=Date.now();
      if(compareStableVersions(release.version,APP_VERSION)>0)
        applyEvent({type:"available",silent,checkedAt,version:release.version,manualOnly:true,downloadUrl:release.downloadUrl,releaseNotes:release.releaseNotes});
      else applyEvent({type:"not-available",silent,checkedAt,version:release.version,manualOnly:true});
      return true;
    }catch(error){
      applyEvent({type:"error",silent,manualOnly:true,message:"Could not verify Android releases.",error:String(error)});
      return false;
    }
  },[applyEvent]);

  // One renderer-owned scheduler respects autoUpdateEnabled; the Electron main process does not also poll.
  useEffect(()=>{
    if(!ready||!autoUpdateEnabled||(!isAndroidApp()&&!window.localitfy.checkForUpdates))return;
    let alive=true;
    const run=async()=>{
      if(!alive||checkingRef.current)return;
      checkingRef.current=true;
      lastAttemptRef.current=Date.now();
      try {
        const ok=isAndroidApp()?await checkAndroid(true):await window.localitfy.checkForUpdates?.({silent:true});
        if(!alive)return;
        if(ok===false) {
          failureCountRef.current=Math.min(4,failureCountRef.current+1);
          const delay=Math.min(CHECK_INTERVAL,15*60*1000*Math.pow(2,failureCountRef.current-1));
          if(retryRef.current!==null)window.clearTimeout(retryRef.current);
          retryRef.current=window.setTimeout(()=>{retryRef.current=null;void run();},delay);
        } else failureCountRef.current=0;
      } catch { /* Scheduled checks must never block application startup. */ }
      finally { checkingRef.current=false; }
    };
    const startup=window.setTimeout(()=>void run(),1800);
    const interval=window.setInterval(()=>{if(Date.now()-lastAttemptRef.current>=CHECK_INTERVAL)void run();},CHECK_INTERVAL);
    const resumed=()=>{if(!document.hidden&&Date.now()-lastAttemptRef.current>=CHECK_INTERVAL)void run();};
    const online=()=>{if(Date.now()-lastAttemptRef.current>=CHECK_INTERVAL)void run();};
    document.addEventListener("visibilitychange",resumed);
    window.addEventListener("online",online);
    return()=>{alive=false;window.clearTimeout(startup);window.clearInterval(interval);
      if(retryRef.current!==null)window.clearTimeout(retryRef.current);retryRef.current=null;
      document.removeEventListener("visibilitychange",resumed);window.removeEventListener("online",online);};
  },[ready,autoUpdateEnabled,checkAndroid]);

  const manualUpdateCheck=useCallback(async()=>{
    if(isAndroidApp()){
      setUpdatePrompt(old=>old.status==="downloaded"?old:{...defaultUpdatePrompt,status:"checking",message:"Checking Android releases..."});
      await checkAndroid(false);
      return;
    }
    if(!window.localitfy.checkForUpdates) {
      setUpdatePrompt({...defaultUpdatePrompt,status:"error",visible:true,message:"Updater is unavailable.",error:"This platform does not have a supported updater."});
      return;
    }
    setUpdatePrompt(old=>old.status==="downloaded"?old:{...defaultUpdatePrompt,status:"checking",message:"Checking for updates..."});
    await window.localitfy.checkForUpdates({silent:false}).catch(error=>{
      const message=friendlyUpdateError(error);
      setUpdatePrompt({...defaultUpdatePrompt,status:"error",visible:true,message,error:message});
    });
  },[checkAndroid]);

  const askUpdaterToDownload=useCallback(async()=>{
    if(isAndroidApp()) {
      const url=updatePrompt.downloadUrl||"";
      if(!updatePrompt.manualOnly || !url.startsWith(ANDROID_RELEASE_PREFIX) || !/^https:\/\/github\.com\/meshahid973\/localtify\/releases\/download\/v\d+\.\d+\.\d+\/localtify-\d+\.\d+\.\d+-android\.apk$/.test(url)){
        setUpdatePrompt(old=>({...old,status:"error",visible:true,message:"No verified APK for this release.",error:"Try checking for updates again."}));
        return;
      }
      try { await window.localitfy.openExternal(url); } catch {
        setUpdatePrompt(old=>({...old,status:"error",visible:true,message:"Unable to open the Android installer.",error:"Open official GitHub releases in your browser."}));
      }
      return;
    }
    if(!window.localitfy.downloadUpdate)return;
    const manual=updatePrompt.manualOnly;
    if(!manual)setUpdatePrompt(old=>({...old,visible:true,status:"downloading",message:"Starting update download…",percent:0,error:""}));
    const success=await window.localitfy.downloadUpdate().catch(()=>false);
    if(!success && !manual) {
      // The main process also sends detailed errors; retain them when they have arrived.
      setUpdatePrompt(old=>old.status==="downloading"?{...old,status:"error",message:"Download could not be started.",error:"Try again."}:old);
    }
  },[updatePrompt.manualOnly,updatePrompt.downloadUrl]);

  const askUpdaterToInstall=useCallback(async()=>{
    if(!window.localitfy.installUpdate)return;
    const ok=await window.localitfy.installUpdate().catch(()=>false);
    if(!ok)setUpdatePrompt(old=>({...old,visible:true,status:"error",message:"Couldn't restart to install.",error:"Try again from Updates settings."}));
  },[]);

  const openUpdateChangelog=useCallback((target:"current"|"available"="current")=>{
    if(target==="available" && updatePrompt.version) {
      setWhatsNewVersion(updatePrompt.version);
      setWhatsNewReleaseNotes(updatePrompt.releaseNotes||"");
    } else {
      setWhatsNewVersion(APP_VERSION);
      setWhatsNewReleaseNotes("");
    }
    setWhatsNewOpen(true);
  },[updatePrompt.version,updatePrompt.releaseNotes]);

  const closeWhatsNew=useCallback(()=>{
    if(whatsNewVersion===APP_VERSION)try {window.localStorage.setItem(WHATS_NEW_SEEN_KEY,APP_VERSION);}catch{}
    setWhatsNewOpen(false);
  },[whatsNewVersion]);

  const handleUpdateLater=useCallback(()=>{
    const version=updatePrompt.version;
    if(version)try{window.localStorage.setItem(UPDATE_LEAVE_ALONE_PREFIX+version,"1");}catch{}
    setUpdatePrompt(old=>({...old,visible:false}));
    setStatusText("Update reminder dismissed.");
  },[updatePrompt.version,setStatusText]);

  const showDebugUpdateAvailable=useCallback(()=>{
    setUpdatePrompt({visible:true,status:"available",version:"test",percent:0,message:"Test update preview",error:"",releaseNotes:"## Preview\nThis is a developer-only update banner preview."});
  },[]);

  return {
    updatePrompt,whatsNewOpen,setWhatsNewOpen,whatsNewVersion,whatsNewReleaseNotes,
    openUpdateChangelog,closeWhatsNew,askUpdaterToDownload,askUpdaterToInstall,manualUpdateCheck,
    handleUpdateLater,skipAvailableUpdate:handleUpdateLater,
    showDebugUpdateAvailable,lastUpdateCheckedLabel
  };
}
