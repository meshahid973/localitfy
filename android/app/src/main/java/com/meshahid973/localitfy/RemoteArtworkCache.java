package com.meshahid973.localitfy;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.content.SharedPreferences;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import java.io.*;
import java.net.URI;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;
import org.json.JSONObject;

/** Disposable, content-addressed cache. Never writes to synced covers or audio. */
final class RemoteArtworkCache {
    private static final int MAX_IMAGE = 2 * 1024 * 1024, MAX_ENTRIES = 512;
    private static final long MAX_BYTES = 64L * 1024 * 1024, MAX_TTL = 7L * 86400000;
    private static final String DIR = "remote-artwork-v1";
    private static final Pattern NAME = Pattern.compile("[a-f0-9]{64}\\.(jpg|png|webp|gif)");
    private final File root;
    private final File localRoot, thumbnails;
    private boolean thumbnailsInitialized;
    private final SharedPreferences index;
    private final Set<String> pending = new HashSet<>();
    private final Map<String,Long> retry = new LinkedHashMap<>();
    private final Map<String,String> verified = new LinkedHashMap<>();
    private boolean initialized;

    RemoteArtworkCache(Context context) {
        root = new File(context.getFilesDir(), DIR);
        localRoot = new File(context.getFilesDir(), "covers");
        thumbnails = new File(context.getFilesDir(), "artwork-thumbnails-v1");
        index = context.getSharedPreferences(DIR, Context.MODE_PRIVATE);
    }

    // Derived images are disposable and never replace original synced artwork.
    synchronized JSObject thumbnail(String relative, String revision, int requested, String failed) throws Exception {
        if(relative==null || !relative.matches("covers/[^/\\\\]{1,180}\\.(?i:jpg|jpeg|png|webp|gif|bmp)") ||
           revision==null || revision.length()>256 || (requested!=96 && requested!=256 && requested!=512)) return new JSObject();
        File source=new File(localRoot,relative.substring(7)).getCanonicalFile();
        if(!localRoot.getCanonicalFile().equals(source.getParentFile()) || !source.isFile()) return new JSObject();
        long length=source.length(), modified=source.lastModified();
        if(length<=0||length>32L*1024*1024) return new JSObject();
        String name=hash(("v1:"+relative+":"+revision+":"+length+":"+modified+":"+requested).getBytes(java.nio.charset.StandardCharsets.UTF_8))+".png";
        String url="https://localhost"+LocalMediaHandler.PREFIX+"artwork-thumbnails-v1/"+name;
        if(!thumbnails.isDirectory()&&!thumbnails.mkdirs())return new JSObject();
        if(!thumbnailsInitialized){pruneThumbnails(null);thumbnailsInitialized=true;}
        File target=new File(thumbnails,name);
        BitmapFactory.Options bounds=new BitmapFactory.Options();
        bounds.inJustDecodeBounds=true;
        if(target.isFile()&&!url.equals(failed)){
            BitmapFactory.decodeFile(target.getPath(),bounds);
            if(bounds.outWidth>0&&bounds.outHeight>0&&Math.max(bounds.outWidth,bounds.outHeight)<=requested){
                if(System.currentTimeMillis()-target.lastModified()>60000)target.setLastModified(System.currentTimeMillis());
                JSObject out=new JSObject();out.put("url",url);return out;
            }
        }
        BitmapFactory.decodeFile(source.getPath(),bounds);
        if(bounds.outWidth<=0||bounds.outHeight<=0||(long)bounds.outWidth*bounds.outHeight>64000000L)return new JSObject();
        BitmapFactory.Options options=new BitmapFactory.Options();
        options.inSampleSize=1;
        while(Math.max(bounds.outWidth,bounds.outHeight)/options.inSampleSize>requested*2)options.inSampleSize*=2;
        Bitmap decoded=BitmapFactory.decodeFile(source.getPath(),options);
        if(decoded==null)return new JSObject();
        Bitmap scaled=decoded;
        File temp=null;
        try{
            double ratio=Math.min(1.0,(double)requested/Math.max(decoded.getWidth(),decoded.getHeight()));
            if(ratio<1)scaled=Bitmap.createScaledBitmap(decoded,Math.max(1,(int)Math.round(decoded.getWidth()*ratio)),Math.max(1,(int)Math.round(decoded.getHeight()*ratio)),true);
            temp=File.createTempFile("thumb-",".part",thumbnails);
            try(FileOutputStream out=new FileOutputStream(temp)){
                if(!scaled.compress(Bitmap.CompressFormat.PNG,100,out))return new JSObject();
            }
            if(Thread.currentThread().isInterrupted()||source.length()!=length||source.lastModified()!=modified||temp.length()>2L*1024*1024)return new JSObject();
            if(!temp.renameTo(target))return new JSObject();
            pruneThumbnails(target);
            JSObject out=new JSObject();out.put("url",url);return out;
        }finally{
            if(temp!=null)temp.delete();
            if(scaled!=decoded)scaled.recycle();
            decoded.recycle();
        }
    }

    private void pruneThumbnails(File keep){
        File[] files=thumbnails.listFiles((dir,name)->name.matches("[a-f0-9]{64}\\.png")||name.endsWith(".part"));
        if(files==null)return;
        Arrays.sort(files,Comparator.comparingLong(File::lastModified));
        long bytes=0;int count=0;
        for(File file:files){if(file.getName().endsWith(".part")){file.delete();continue;}bytes+=file.length();count++;}
        for(File file:files){
            if(bytes<=32L*1024*1024&&count<=2048)break;
            if(file.equals(keep)||!file.getName().endsWith(".png"))continue;
            long length=file.length();if(file.delete()){bytes-=length;count--;}
        }
    }

    // Same download-eligible provider subset as Electron; display-only sources never enter disk cache.
    static boolean eligible(String value) {
        if (value == null || value.length() > 2000) return false;
        try {
            URI u = new URI(value);
            String host = u.getHost(), p = u.getRawPath();
            if (!"https".equals(u.getScheme()) || host == null || u.getPort()!=-1 ||
                u.getRawUserInfo()!=null || u.getRawQuery()!=null || u.getRawFragment()!=null) return false;
            if (host.matches("lh[0-9]+\\.googleusercontent\\.com|yt3\\.ggpht\\.com|yt3\\.googleusercontent\\.com"))
                return p.matches("/[A-Za-z0-9_-]+=w256-h256-l90-rj");
            if (host.equals("i.ytimg.com")) return p.matches("/vi/[A-Za-z0-9_-]{11}/(hqdefault|mqdefault|default|sddefault|maxresdefault)\\.jpg");
            if (host.equals("i.scdn.co")) return p.matches("(?i)/image/[a-f0-9]+");
            if (host.equals("lastfm.freetls.fastly.net") || host.equals("lastfm-img2.akamaized.net"))
                return p.matches("(?i)/i/u/([0-9]+x[0-9]+|[0-9]+s)/[a-f0-9]{32}\\.(png|jpe?g|webp)") &&
                    !p.toLowerCase(Locale.ROOT).matches(".*(2a96cbd8b46e442fc41c2b86b821562f|4128a6eb29f94943c9d206c08e625904).*");
            if (host.equals("www.theaudiodb.com") || host.equals("r2.theaudiodb.com") || host.equals("theaudiodb.com"))
                return p.matches("(?i)/images/media/album/thumb/[a-z0-9_-]+\\.(jpg|jpeg|png)(/(small|medium))?");
        } catch (Exception ignored) {}
        return false;
    }
    private static String hash(byte[] bytes) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder result = new StringBuilder(64);
        final char[] hex="0123456789abcdef".toCharArray();
        for (byte b : digest) { result.append(hex[(b & 255) >>> 4]); result.append(hex[b & 15]); }
        return result.toString();
    }
    private static byte[] read(InputStream in,long deadline) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192]; int n;
        while((n=in.read(chunk))!=-1) {
            if (out.size()+n>MAX_IMAGE || SystemClock.elapsedRealtime()>deadline) throw new IOException("Artwork limit");
            out.write(chunk,0,n);
        }
        return out.toByteArray();
    }
    private static long ttl(HttpURLConnection c, JSONObject previous) {
        String cc = c.getHeaderField("Cache-Control"), vary=c.getHeaderField("Vary");
        if ((vary!=null&&!vary.trim().isEmpty()) ||
            Pattern.compile("(?i)(^|,)\\s*(no-store|no-cache|private)(\\s*[=,]|\\s*$)").matcher(cc==null?"":cc).find()) return 0;
        if(cc==null)return previous==null?0:Math.min(MAX_TTL,previous.optLong("ttl"));
        Matcher m=Pattern.compile("(?i)(^|,)\\s*max-age\\s*=\\s*(\\d+)").matcher(cc);
        if (!m.find()) return 0;
        try { return Math.max(0,Math.min(MAX_TTL,Math.min(604800L,Long.parseLong(m.group(2)))*1000)-Math.min(MAX_TTL,Math.max(0,c.getHeaderFieldLong("Age",0))*1000)); }
        catch(NumberFormatException e) { return 0; }
    }
    private static long stale(HttpURLConnection c, JSONObject previous) {
        String cc=c.getHeaderField("Cache-Control");
        if(cc==null)return previous==null?0:Math.min(86400000L,previous.optLong("stale"));
        if(Pattern.compile("(?i)(^|,)\\s*(must-revalidate|proxy-revalidate)\\s*(,|$)").matcher(cc).find())return 0;
        Matcher m=Pattern.compile("(?i)(^|,)\\s*stale-while-revalidate\\s*=\\s*(\\d+)").matcher(cc);
        try{return m.find()?Math.min(86400L,Long.parseLong(m.group(2)))*1000:0;}catch(NumberFormatException e){return 0;}
    }
    private static String validator(String value) {
        return value!=null&&value.length()<=512&&!value.contains("\r")&&!value.contains("\n")?value:"";
    }
    private static String extension(byte[] b,String mime) {
        if (b.length<12 || mime==null) return "";
        String type=mime.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if(type.equals("image/jpeg")&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255)return ".jpg";
        if(type.equals("image/png")&&Arrays.equals(Arrays.copyOf(b,8),new byte[]{(byte)137,80,78,71,13,10,26,10}))return ".png";
        String first=new String(b,0,12,java.nio.charset.StandardCharsets.US_ASCII);
        if(type.equals("image/webp")&&first.startsWith("RIFF")&&first.endsWith("WEBP"))return ".webp";
        if(type.equals("image/gif")&&(first.startsWith("GIF87a")||first.startsWith("GIF89a")))return ".gif";
        return "";
    }
    private JSONObject row(String key) {
        try {return new JSONObject(index.getString(key,"{}"));} catch(Exception e){return new JSONObject();}
    }
    private JSObject result(String name,long expires) {
        JSObject out=new JSObject();
        out.put("url","https://localhost"+LocalMediaHandler.PREFIX+DIR+"/"+name);
        out.put("cacheTtlMs",Math.max(0,expires-System.currentTimeMillis()));
        return out;
    }
    private boolean validFile(JSONObject row) throws Exception {
        String name=row.optString("file");
        if(!NAME.matcher(name).matches())return false;
        File f=new File(root,name);
        if(!f.isFile()||f.length()!=row.optLong("bytes")||f.length()>MAX_IMAGE)return false;
        android.system.StructStat stat;
        try{stat=android.system.Os.lstat(f.getAbsolutePath());}catch(android.system.ErrnoException e){return false;}
        if(!android.system.OsConstants.S_ISREG(stat.st_mode))return false;
        String stamp=stat.st_ino+":"+stat.st_size+":"+stat.st_mtime+":"+stat.st_ctime+":"+f.lastModified();
        if(stamp.equals(verified.get(name)))return true;
        try(InputStream in=new FileInputStream(f)) {
            if(!hash(read(in,SystemClock.elapsedRealtime()+2000)).equals(name.substring(0,64)))return false;
        }
        verified.put(name,stamp);
        while(verified.size()>MAX_ENTRIES)verified.remove(verified.keySet().iterator().next());
        return true;
    }
    private long staleUntil(JSONObject r){
        return Math.min(r.optLong("expires")+86400000L,r.optLong("staleUntil",r.optLong("expires")));
    }
    private long retainUntil(JSONObject r){
        return Math.max(staleUntil(r),(!r.optString("etag").isEmpty()||!r.optString("modified").isEmpty())?r.optLong("expires")+86400000L:r.optLong("expires"));
    }
    private void touch(String key,JSONObject r,long now) throws Exception {
        if(now-r.optLong("access")>60000) {r.put("access",now);index.edit().putString(key,r.toString()).apply();}
    }
    private synchronized void prune() {
        Map<String,?> all=index.getAll();
        Map<String,JSONObject> rows=new HashMap<>();
        for(String key:all.keySet())rows.put(key,row(key));
        List<String> keys=new ArrayList<>(rows.keySet());
        keys.sort(Comparator.comparingLong(k->rows.get(k).optLong("access")));
        Map<String,Integer> refs=new HashMap<>();
        Set<String> validKeys=new HashSet<>();
        long bytes=0; int entries=0; long now=System.currentTimeMillis();
        SharedPreferences.Editor edit=index.edit();
        for(String key:keys) {
            JSONObject r=rows.get(key); String n=r.optString("file"); long size=r.optLong("bytes");
            if(!NAME.matcher(n).matches()||size<=0||size>MAX_IMAGE||retainUntil(r)<=now||!new File(root,n).isFile()) {edit.remove(key);continue;}
            if(!refs.containsKey(n))bytes+=size;
            refs.put(n,refs.getOrDefault(n,0)+1);entries++;validKeys.add(key);
        }
        for(String key:keys) {
            if(entries<=MAX_ENTRIES&&bytes<=MAX_BYTES)break;
            if(!validKeys.contains(key))continue;
            JSONObject r=rows.get(key);String n=r.optString("file");
            if(retainUntil(r)<=now||!refs.containsKey(n)||r.optLong("bytes")<=0||r.optLong("bytes")>MAX_IMAGE)continue;
            edit.remove(key);entries--;
            int count=refs.get(n)-1;
            if(count==0){refs.remove(n);bytes-=r.optLong("bytes");}else refs.put(n,count);
        }
        edit.apply();
        File[] files=root.listFiles();
        if(files!=null)for(File file:files) {
            String n=file.getName();
            if(NAME.matcher(n).matches()&&!refs.containsKey(n))file.delete();
            else if(n.endsWith(".part")&&now-file.lastModified()>3600000L)file.delete();
        }
    }
    JSObject resolve(String url, java.util.concurrent.Executor executor) throws Exception {
        if(!eligible(url))return new JSObject();
        String key=hash(url.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        JSONObject previous;
        synchronized(this) {
            if(!initialized){prune();initialized=true;}
            long now=System.currentTimeMillis();
            previous=row(key);
            if(validFile(previous)){
                touch(key,previous,now);
                if(previous.optLong("expires")>now)return result(previous.optString("file"),previous.optLong("expires"));
                if(staleUntil(previous)>now){
                    if(!pending.contains(key)&&retry.getOrDefault(key,0L)<=now){
                        pending.add(key);
                        final JSONObject prior=previous;
                        try{executor.execute(()->{try{refresh(url,key,prior);}catch(Exception ignored){}});}
                        catch(java.util.concurrent.RejectedExecutionException busy){pending.remove(key);}
                    }
                    return result(previous.optString("file"),staleUntil(previous));
                }
            }else previous=null;
            if(pending.contains(key)||retry.getOrDefault(key,0L)>now)return new JSObject();
            pending.add(key);
        }
        return refresh(url,key,previous);
    }
    private JSObject refresh(String url,String key,JSONObject previous) throws Exception {
        HttpURLConnection c=null;
        try {
            c=(HttpURLConnection)new URI(url).toURL().openConnection();
            c.setInstanceFollowRedirects(false);c.setUseCaches(false);
            c.setConnectTimeout(1400);c.setReadTimeout(1400);
            c.setRequestProperty("Accept","image/png,image/jpeg,image/webp,image/gif");
            if(previous!=null){
                String etag=validator(previous.optString("etag")), modified=validator(previous.optString("modified"));
                if(!etag.isEmpty())c.setRequestProperty("If-None-Match",etag);
                if(!modified.isEmpty())c.setRequestProperty("If-Modified-Since",modified);
            }
            long deadline=SystemClock.elapsedRealtime()+2500;
            int status=c.getResponseCode();
            long duration=ttl(c,status==304?previous:null);
            long stale=stale(c,status==304?previous:null);
            if((status==200||status==304)&&duration<=0){synchronized(this){index.edit().remove(key).apply();prune();}return new JSObject();}
            if(status==304&&previous!=null){
                synchronized(this){
                    if(!validFile(previous))return new JSObject();
                    long expires=System.currentTimeMillis()+duration;
                    previous.put("expires",expires);previous.put("staleUntil",expires+stale);
                    previous.put("ttl",duration);previous.put("stale",stale);
                    previous.put("access",System.currentTimeMillis());
                    String etag=validator(c.getHeaderField("ETag")), modified=validator(c.getHeaderField("Last-Modified"));
                    if(!etag.isEmpty())previous.put("etag",etag);
                    if(!modified.isEmpty())previous.put("modified",modified);
                    index.edit().putString(key,previous.toString()).apply();
                    return result(previous.optString("file"),expires);
                }
            }
            if(status!=200||c.getContentLengthLong()>MAX_IMAGE)return new JSObject();
            byte[] bytes;
            try(InputStream in=c.getInputStream()){bytes=read(in,deadline);}
            String ext=extension(bytes,c.getContentType());if(ext.isEmpty())return new JSObject();
            String name=hash(bytes)+ext;
            synchronized(this) {
                if(!root.isDirectory()&&!root.mkdirs())return new JSObject();
                File target=new File(root,name);
                File temp=File.createTempFile("cover-",".part",root);
                try {
                    JSONObject existing=new JSONObject();existing.put("file",name);existing.put("bytes",bytes.length);
                    if(!validFile(existing)) {
                        try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);out.getFD().sync();}
                        if(!temp.renameTo(target))throw new IOException("Artwork replacement failed");
                        verified.remove(name);
                    }
                    long expires=System.currentTimeMillis()+duration;
                    JSONObject r=new JSONObject();r.put("file",name);r.put("bytes",bytes.length);r.put("expires",expires);r.put("access",System.currentTimeMillis());
                    r.put("ttl",duration);r.put("stale",stale);r.put("staleUntil",expires+stale);
                    r.put("etag",validator(c.getHeaderField("ETag")));r.put("modified",validator(c.getHeaderField("Last-Modified")));
                    index.edit().putString(key,r.toString()).apply();
                    prune();
                    if(target.isFile())return result(name,expires);
                } finally {temp.delete();}
            }
            return new JSObject();
        } finally {
            if(c!=null)c.disconnect();
            synchronized(this) {
                pending.remove(key);
                retry.put(key,System.currentTimeMillis()+15000);
                while(retry.size()>512)retry.remove(retry.keySet().iterator().next());
            }
        }
    }
}
