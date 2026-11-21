/** Verified published GitHub releases are bundled for offline browsing, while online installs can refresh the list. */
import installedNotes from "../../../.github/release-notes.md?raw";
import { APP_VERSION } from "./update.constants";
import officialArchive from "./publishedHistory.json";

export type ReleaseEntry={version:string;date:string|null;notes:string;published:boolean;sourceUrl?:string};
export const releaseHistory:readonly ReleaseEntry[]=[
  {version:APP_VERSION,date:null,notes:installedNotes,published:false},
  ...(officialArchive as ReleaseEntry[]).filter(entry=>entry.version!==APP_VERSION)
];
export function findRelease(version:string) {
  return releaseHistory.find(entry=>entry.version===String(version).replace(/^v/i,""));
}
const RELEASES_API="https://api.github.com/repos/meshahid973/localtify/releases?per_page=100";
let cached:readonly ReleaseEntry[]|null=null;
let cachedUntil=0;
let pending:Promise<readonly ReleaseEntry[]>|null=null;

function cleanRemote(value:unknown):ReleaseEntry|null {
  if(!value||typeof value!=="object")return null;
  const raw=value as Record<string,unknown>;
  if(raw.draft===true||raw.prerelease===true)return null;
  const tag=String(raw.tag_name||"");
  const match=/^v?(\d+\.\d+\.\d+)$/.exec(tag);
  if(!match||typeof raw.body!=="string"||typeof raw.published_at!=="string")return null;
  const sourceUrl=String(raw.html_url||"");
  if(sourceUrl!=="https://github.com/meshahid973/localtify/releases/tag/"+tag)return null;
  return {version:match[1],date:raw.published_at.slice(0,10),
    notes:raw.body.slice(0,100000),published:true,sourceUrl};
}
function versionOrder(a:ReleaseEntry,b:ReleaseEntry){
  const aa=a.version.split(".").map(Number),bb=b.version.split(".").map(Number);
  for(let i=0;i<3;i++)if(aa[i]!==bb[i])return bb[i]-aa[i];
  return 0;
}
export async function loadReleaseHistory(fetcher:typeof fetch=fetch):Promise<readonly ReleaseEntry[]> {
  if(cached && Date.now()<cachedUntil)return cached;
  if(pending)return pending;
  pending=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6500);
    try {
      const response=await fetcher(RELEASES_API,{headers:{Accept:"application/vnd.github+json"},signal:controller.signal});
      if(!response.ok)throw Error("Release history unavailable");
      const payload:unknown=await response.json();
      if(!Array.isArray(payload))throw Error("Malformed release history");
      const versions=new Map(releaseHistory.map(entry=>[entry.version,entry]));
      for(const item of payload){
        const entry=cleanRemote(item);
        if(!entry)continue;
        versions.set(entry.version,entry.version===APP_VERSION?{...entry,notes:installedNotes}:entry);
      }
      return [...versions.values()].sort(versionOrder);
    }catch{return releaseHistory;}
    finally{clearTimeout(timer);}
  })();
  try{cached=await pending;cachedUntil=Date.now()+6*60*60*1000;return cached;}
  finally{pending=null;}
}
