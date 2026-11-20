package com.meshahid973.localitfy;

import android.content.Context;
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
    private final SharedPreferences index;
    private final Set<String> pending = new HashSet<>();
    private final Map<String,Long> retry = new LinkedHashMap<>();

    RemoteArtworkCache(Context context) {
        root = new File(context.getFilesDir(), DIR);
        index = context.getSharedPreferences(DIR, Context.MODE_PRIVATE);
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
        for (byte b : digest) result.append(String.format(Locale.ROOT,"%02x", b & 255));
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
    private static long ttl(HttpURLConnection c) {
        String cc = c.getHeaderField("Cache-Control"), vary=c.getHeaderField("Vary");
        if (cc==null || (vary!=null&&!vary.trim().isEmpty()) ||
            Pattern.compile("(?i)(^|,)\\s*(no-store|no-cache|private)(\\s*[=,]|\\s*$)").matcher(cc).find()) return 0;
        Matcher m=Pattern.compile("(?i)(^|,)\\s*max-age\\s*=\\s*(\\d+)").matcher(cc);
        if (!m.find()) return 0;
        try { return Math.max(0,Math.min(MAX_TTL,Math.min(604800L,Long.parseLong(m.group(2)))*1000)-Math.min(MAX_TTL,Math.max(0,c.getHeaderFieldLong("Age",0))*1000)); }
        catch(NumberFormatException e) { return 0; }
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
    private synchronized JSObject hit(String key) throws Exception {
        JSONObject row=row(key);
        String name=row.optString("file"); long expires=row.optLong("expires");
        if (!NAME.matcher(name).matches()||expires<=System.currentTimeMillis()) return null;
        File f=new File(root,name);
        if (!f.isFile()||f.length()!=row.optLong("bytes")||f.length()>MAX_IMAGE) return null;
        try(InputStream in=new FileInputStream(f)) {
            if(!hash(read(in,SystemClock.elapsedRealtime()+2000)).equals(name.substring(0,64)))return null;
        }
        row.put("access",System.currentTimeMillis());
        index.edit().putString(key,row.toString()).apply();
        return result(name,expires);
    }
    private synchronized void prune() {
        Map<String,?> all=index.getAll();
        List<String> keys=new ArrayList<>(all.keySet());
        keys.sort(Comparator.comparingLong(k->row(k).optLong("access")));
        Map<String,Integer> refs=new HashMap<>();
        long bytes=0; int entries=0; long now=System.currentTimeMillis();
        SharedPreferences.Editor edit=index.edit();
        for(String key:keys) {
            JSONObject r=row(key); String n=r.optString("file"); long size=r.optLong("bytes");
            if(!NAME.matcher(n).matches()||size<=0||size>MAX_IMAGE||r.optLong("expires")<=now||!new File(root,n).isFile()) {edit.remove(key);continue;}
            if(!refs.containsKey(n))bytes+=size;
            refs.put(n,refs.getOrDefault(n,0)+1);entries++;
        }
        for(String key:keys) {
            if(entries<=MAX_ENTRIES&&bytes<=MAX_BYTES)break;
            JSONObject r=row(key);String n=r.optString("file");
            if(r.optLong("expires")<=now||!refs.containsKey(n)||r.optLong("bytes")<=0||r.optLong("bytes")>MAX_IMAGE)continue;
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
    JSObject resolve(String url) throws Exception {
        if(!eligible(url))return new JSObject();
        String key=hash(url.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        synchronized(this) {
            JSObject cached=hit(key); if(cached!=null)return cached;
            if(pending.contains(key)||retry.getOrDefault(key,0L)>System.currentTimeMillis())return new JSObject();
            pending.add(key);
        }
        HttpURLConnection c=null;
        try {
            c=(HttpURLConnection)new URI(url).toURL().openConnection();
            c.setInstanceFollowRedirects(false);c.setUseCaches(false);
            c.setConnectTimeout(1400);c.setReadTimeout(1400);
            c.setRequestProperty("Accept","image/png,image/jpeg,image/webp,image/gif");
            long deadline=SystemClock.elapsedRealtime()+2000;
            if(c.getResponseCode()!=200||c.getContentLengthLong()>MAX_IMAGE)return new JSObject();
            long duration=ttl(c);if(duration<=0)return new JSObject();
            byte[] bytes;
            try(InputStream in=c.getInputStream()){bytes=read(in,deadline);}
            String ext=extension(bytes,c.getContentType());if(ext.isEmpty())return new JSObject();
            String name=hash(bytes)+ext;
            synchronized(this) {
                if(!root.isDirectory()&&!root.mkdirs())return new JSObject();
                File target=new File(root,name);
                File temp=File.createTempFile("cover-",".part",root);
                try {
                    try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);out.getFD().sync();}
                    if(!temp.renameTo(target))throw new IOException("Artwork replacement failed");
                    long expires=System.currentTimeMillis()+duration;
                    JSONObject r=new JSONObject();r.put("file",name);r.put("bytes",bytes.length);r.put("expires",expires);r.put("access",System.currentTimeMillis());
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
