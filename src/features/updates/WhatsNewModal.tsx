import "./updates.css";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, ExternalLink, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useModalFocus } from "../../shared/hooks/useModalFocus";
import { APP_VERSION } from "./update.constants";
import { findRelease, releaseHistory, loadReleaseHistory } from "./releaseHistory";

export type WhatsNewModalProps = { open: boolean; onClose: () => void; initialVersion?: string; availableReleaseNotes?: string };

export default function WhatsNewModal({open,onClose,initialVersion,availableReleaseNotes}:WhatsNewModalProps) {
  const dialogRef=useModalFocus<HTMLElement>(open);
  const [version,setVersion]=useState(APP_VERSION);
  const [history,setHistory]=useState(releaseHistory);
  useEffect(()=>{
    if(!open)return;
    let active=true;
    void loadReleaseHistory().then(items=>{if(active)setHistory(items as typeof releaseHistory);});
    return()=>{active=false;};
  },[open]);
  const remoteVersion=String(initialVersion||"").replace(/^v/i,"");
  useEffect(()=>{if(open)setVersion(remoteVersion||APP_VERSION);},[open,remoteVersion]);
  const release=useMemo(()=>{
    const local=history.find(entry=>entry.version===version)||findRelease(version);
    if(version===remoteVersion && availableReleaseNotes?.trim())return {version,date:null,notes:availableReleaseNotes,published:true,sourceUrl:undefined};
    return local||null;
  },[version,remoteVersion,availableReleaseNotes,history]);
  useEffect(()=>{
    if(!open)return;
    const handler=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||event.defaultPrevented)return;
      const top=Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
      if(top!==dialogRef.current)return;
      event.preventDefault();event.stopPropagation();onClose();
    };
    document.addEventListener("keydown",handler);
    return()=>document.removeEventListener("keydown",handler);
  },[dialogRef,open,onClose]);
  if(!open)return null;
  return <div className="releaseNotesOverlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="releaseNotesDialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="releaseNotesTitle" tabIndex={-1}>
      <header className="releaseNotesHead">
        <div><span className="releaseNotesEyebrow"><BookOpen size={13}/> Release history</span>
          <h2 id="releaseNotesTitle">What's new in Localtify</h2>
          <p>Updates, improvements and fixes across releases.</p>
        </div>
        <button type="button" className="releaseNotesClose" aria-label="Close release notes" onClick={onClose}><X size={20}/></button>
      </header>
      <div className="releaseNotesMain">
        <nav className="releaseNotesVersions" aria-label="Available versions">
          {remoteVersion&&availableReleaseNotes&&!history.some(item=>item.version===remoteVersion)?<button type="button" className={version===remoteVersion?"selected":""} onClick={()=>setVersion(remoteVersion)}>v{remoteVersion}<span>Available update</span></button>:null}
          {history.map(item=><button type="button" key={item.version} className={version===item.version?"selected":""} aria-current={version===item.version?"true":undefined} onClick={()=>setVersion(item.version)}>
            v{item.version}{item.version===APP_VERSION?<Check size={13}/>:null}
            <span>{item.published?item.date:"Current build"}</span>
          </button>)}
        </nav>
        <article className="releaseNotesContent">
          {release ? <>
            <div className="releaseNotesVersionTitle"><div><span>{release.published?(release.date||"New release"):"Included in this build"}</span><h3>Localtify {release.version}</h3></div>
              {release.sourceUrl?<a href={release.sourceUrl} target="_blank" rel="noopener noreferrer" title="View original GitHub release">Source <ExternalLink size={13}/></a>:null}
            </div>
            <div className="releaseNotesMarkdown">
              <ReactMarkdown skipHtml urlTransform={url=>/^https:\/\//i.test(url)?url:""}>{release.notes}</ReactMarkdown>
            </div>
          </> : <p className="releaseNotesMissing">Release notes for this version aren't available yet.</p>}
        </article>
      </div>
      <footer className="releaseNotesFooter"><span><ChevronDown size={14}/> Scroll to read all changes</span><button type="button" onClick={onClose}>Done</button></footer>
    </section>
  </div>;
}
