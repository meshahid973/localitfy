/** Manual Android APK updates use official GitHub Release assets and OS installation consent. */
export const ANDROID_RELEASES_API="https://api.github.com/repos/meshahid973/localtify/releases/latest";
export const ANDROID_RELEASE_PREFIX="https://github.com/meshahid973/localtify/releases/download/";
export type AndroidReleaseInfo={version:string;downloadUrl:string;releaseNotes:string};
export function compareStableVersions(left:string,right:string) {
  const parse=(s:string)=>{const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(s);return match?match.slice(1).map(Number):null;};
  const a=parse(left),b=parse(right);
  if(!a||!b)return 0;
  for(let i=0;i<3;i++)if(a[i]!==b[i])return Math.sign(a[i]-b[i]);
  return 0;
}
export async function fetchOfficialAndroidRelease(fetcher:typeof fetch=fetch):Promise<AndroidReleaseInfo> {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try {
    const response=await fetcher(ANDROID_RELEASES_API,{headers:{Accept:"application/vnd.github+json"},signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw Error("Android release metadata unavailable");
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object")throw Error("Invalid Android release");
    const release=raw as Record<string,unknown>,tag=String(release.tag_name||"");
    const match=/^v(\d+\.\d+\.\d+)$/.exec(tag);
    if(!match||release.draft===true||release.prerelease===true||!Array.isArray(release.assets))throw Error("Unverified Android release");
    const version=match[1],expected="localtify-"+version+"-android.apk";
    const asset=release.assets.find((entry:unknown)=>{
      if(!entry||typeof entry!=="object")return false;
      const item=entry as Record<string,unknown>;
      return item.name===expected && typeof item.browser_download_url==="string" &&
        item.browser_download_url.startsWith(ANDROID_RELEASE_PREFIX+tag+"/") &&
        item.browser_download_url.endsWith("/"+expected) && Number(item.size)>0;
    }) as Record<string,unknown>|undefined;
    if(!asset)throw Error("Android APK is missing from release");
    return {version,downloadUrl:String(asset.browser_download_url),releaseNotes:typeof release.body==="string"?release.body.slice(0,100000):""};
  }finally{clearTimeout(timer);}
}
